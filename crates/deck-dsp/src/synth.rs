use std::error::Error;
use std::f64::consts::PI;
use std::fmt;

const PATTERN_STEPS: usize = 32;
const BASS_LINE_LENGTH: usize = 8;
const BASS_NOTE_POOL: usize = 3;
const BASS_OCTAVE_DROP: i32 = 12;
const NOTE_PROBABILITY: f64 = 0.72;
const OCTAVE_PROBABILITY: f64 = 0.3;
const OCTAVE_SEMITONES: i32 = 12;
const MIN_SCALE_NOTES: usize = BASS_NOTE_POOL;
const RNG_INCREMENT: u32 = 0x6D2B_79F5;
const TWO_POW_32: f64 = 4_294_967_296.0;

type Pattern = [Option<i32>; PATTERN_STEPS];

#[derive(Clone, Copy, Debug)]
pub struct TrackSpec<'a> {
    pub seed: u32,
    pub bpm: f64,
    pub seconds: f64,
    pub root_hz: f64,
    pub scale: &'a [i32],
}

#[derive(Clone, Copy, Debug)]
pub struct DemoTrack {
    pub file: &'static str,
    pub spec: TrackSpec<'static>,
}

pub const DEMO_TRACKS: [DemoTrack; 3] = [
    DemoTrack {
        file: "demo-tech-house-126.wav",
        spec: TrackSpec {
            seed: 11,
            bpm: 126.0,
            seconds: 48.0,
            root_hz: 110.0,
            scale: &[0, 3, 5, 7, 10],
        },
    },
    DemoTrack {
        file: "demo-dubstep-140.wav",
        spec: TrackSpec {
            seed: 29,
            bpm: 140.0,
            seconds: 48.0,
            root_hz: 98.0,
            scale: &[0, 1, 4, 7, 8],
        },
    },
    DemoTrack {
        file: "demo-trance-136.wav",
        spec: TrackSpec {
            seed: 47,
            bpm: 136.0,
            seconds: 48.0,
            root_hz: 123.47,
            scale: &[0, 2, 4, 7, 9],
        },
    },
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpecError {
    InvalidTempo,
    InvalidDuration,
    InvalidSampleRate,
    ScaleTooShort,
}

impl fmt::Display for SpecError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidTempo => "tempo must be a positive number",
            Self::InvalidDuration => "duration must be a non-negative number",
            Self::InvalidSampleRate => "sample rate must be positive",
            Self::ScaleTooShort => "scale needs at least three notes",
        };
        formatter.write_str(message)
    }
}

impl Error for SpecError {}

struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    fn next_unit(&mut self) -> f64 {
        self.state = self.state.wrapping_add(RNG_INCREMENT);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / TWO_POW_32
    }

    fn pick(&mut self, length: usize) -> usize {
        (self.next_unit() * length as f64).floor() as usize
    }
}

fn note(root_hz: f64, semitone: i32) -> f64 {
    root_hz * 2f64.powf(f64::from(semitone) / 12.0)
}

fn build_pattern(rng: &mut Mulberry32, scale: &[i32]) -> Pattern {
    let mut pattern = [None; PATTERN_STEPS];
    for step in &mut pattern {
        let roll = rng.next_unit();
        let degree = scale[rng.pick(scale.len())];
        let octave = if rng.next_unit() < OCTAVE_PROBABILITY {
            OCTAVE_SEMITONES
        } else {
            0
        };
        *step = (roll < NOTE_PROBABILITY).then_some(degree + octave);
    }
    pattern
}

fn build_bass_line(rng: &mut Mulberry32, scale: &[i32]) -> Vec<i32> {
    (0..BASS_LINE_LENGTH)
        .map(|_| scale[rng.pick(BASS_NOTE_POOL)] - BASS_OCTAVE_DROP)
        .collect()
}

struct Voices {
    rate: f64,
    beat: f64,
    sixteenth: f64,
    bar: f64,
    root_hz: f64,
    patterns: Vec<Pattern>,
    bass_line: Vec<i32>,
}

impl Voices {
    fn kick(&self, position: f64) -> f64 {
        let time = (position % self.beat) / self.rate;
        let phase = 2.0 * PI * (45.0 * time + (75.0 / 18.0) * (1.0 - (-18.0 * time).exp()));
        phase.sin() * (-time * 9.0).exp() * 0.9
    }

    fn bass(&self, position: f64) -> f64 {
        let half_beat = self.beat / 2.0;
        let on_offbeat = (position / half_beat).floor() as u64 % 2 == 1;
        if !on_offbeat {
            return 0.0;
        }
        let time = (position % half_beat) / self.rate;
        let bar_index = (position / self.bar).floor() as usize % self.bass_line.len();
        let hz = note(self.root_hz / 2.0, self.bass_line[bar_index]);
        (2.0 * PI * hz * time).sin() * (-time * 5.0).exp() * 0.35
    }

    fn lead(&self, position: f64) -> f64 {
        let step = (position / self.sixteenth).floor() as usize;
        let pattern_index =
            ((position / (self.bar * 2.0)).floor() as usize).min(self.patterns.len() - 1);
        let Some(semitone) = self.patterns[pattern_index][step % PATTERN_STEPS] else {
            return 0.0;
        };
        let time = (position % self.sixteenth) / self.rate;
        let hz = note(self.root_hz * 2.0, semitone);
        let envelope = (-time * 14.0).exp();
        ((2.0 * PI * hz * time).sin() + 0.4 * (4.0 * PI * hz * time).sin()) * envelope * 0.18
    }

    fn hat(&self, position: f64, rng: &mut Mulberry32) -> f64 {
        let time = ((position + self.beat / 2.0) % self.beat) / self.rate;
        (rng.next_unit() * 2.0 - 1.0) * (-time * 60.0).exp() * 0.12
    }
}

fn validate(spec: &TrackSpec<'_>, sample_rate: u32) -> Result<(), SpecError> {
    if !(spec.bpm.is_finite() && spec.bpm > 0.0) {
        return Err(SpecError::InvalidTempo);
    }
    if !(spec.seconds.is_finite() && spec.seconds >= 0.0) {
        return Err(SpecError::InvalidDuration);
    }
    if sample_rate == 0 {
        return Err(SpecError::InvalidSampleRate);
    }
    if spec.scale.len() < MIN_SCALE_NOTES {
        return Err(SpecError::ScaleTooShort);
    }
    Ok(())
}

pub fn render_track(spec: &TrackSpec<'_>, sample_rate: u32) -> Result<Vec<f32>, SpecError> {
    validate(spec, sample_rate)?;
    let rate = f64::from(sample_rate);
    let total = (spec.seconds * rate).floor() as usize;
    let beat = (60.0 / spec.bpm) * rate;
    let bar = beat * 4.0;

    let mut rng = Mulberry32::new(spec.seed);
    let pattern_count = (total as f64 / (bar * 2.0)).ceil() as usize;
    let patterns = (0..pattern_count)
        .map(|_| build_pattern(&mut rng, spec.scale))
        .collect();
    let bass_line = build_bass_line(&mut rng, spec.scale);
    let voices = Voices {
        rate,
        beat,
        sixteenth: beat / 4.0,
        bar,
        root_hz: spec.root_hz,
        patterns,
        bass_line,
    };

    Ok((0..total)
        .map(|index| {
            let position = index as f64;
            let mixed = voices.kick(position)
                + voices.bass(position)
                + voices.lead(position)
                + voices.hat(position, &mut rng);
            mixed.clamp(-1.0, 1.0) as f32
        })
        .collect())
}
