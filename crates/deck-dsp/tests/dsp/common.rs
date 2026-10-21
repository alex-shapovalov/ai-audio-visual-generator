use std::collections::HashMap;
use std::sync::LazyLock;

use deck_dsp::{
    BeatTracker, DEMO_TRACKS, Fingerprint, Library, LibraryBuilder, Section, SectionTracker,
    Simulator, fingerprint, render_track,
};

pub const RATE: u32 = 11_025;
pub const FRAME_MS: f64 = 1000.0 / 60.0;
const SIMULATED_SECONDS: f64 = 60.0;
const LCG_MULTIPLIER: u32 = 1_664_525;
const LCG_INCREMENT: u32 = 1_013_904_223;
const TWO_POW_32: f64 = 4_294_967_296.0;

pub struct Track {
    pub id: &'static str,
    pub samples: Vec<f32>,
    pub print: Fingerprint,
}

pub static TRACKS: LazyLock<Vec<Track>> = LazyLock::new(|| {
    DEMO_TRACKS
        .iter()
        .map(|demo| {
            let samples = render_track(&demo.spec, RATE).expect("demo specs are valid");
            let print = fingerprint(&samples);
            Track {
                id: demo.file,
                samples,
                print,
            }
        })
        .collect()
});

pub fn library_of(entries: &[(&str, &Fingerprint)]) -> Library {
    let mut builder = LibraryBuilder::default();
    for (id, print) in entries {
        builder
            .add_cue(*id, &print.hashes, &print.times)
            .expect("fingerprints have matching hash and time counts");
    }
    builder.build()
}

pub fn demo_library() -> Library {
    let entries: Vec<(&str, &Fingerprint)> = TRACKS
        .iter()
        .map(|track| (track.id, &track.print))
        .collect();
    library_of(&entries)
}

pub struct Lcg {
    state: u32,
}

impl Lcg {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    pub fn next_signed(&mut self) -> f64 {
        self.state = self
            .state
            .wrapping_mul(LCG_MULTIPLIER)
            .wrapping_add(LCG_INCREMENT);
        f64::from(self.state) / TWO_POW_32 * 2.0 - 1.0
    }
}

pub fn excerpt(
    samples: &[f32],
    start_seconds: f64,
    seconds: f64,
    noise: f64,
    gain: f64,
) -> Vec<f32> {
    let start = (start_seconds * f64::from(RATE)).floor() as usize;
    let length = (seconds * f64::from(RATE)).floor() as usize;
    let end = (start + length).min(samples.len());
    let mut lcg = Lcg::new(1234);
    samples[start..end]
        .iter()
        .map(|&sample| (f64::from(sample) * gain + lcg.next_signed() * noise) as f32)
        .collect()
}

pub fn uniform_noise(seconds: f64, amplitude: f64, seed: u32) -> Vec<f32> {
    let mut lcg = Lcg::new(seed);
    let length = (seconds * f64::from(RATE)).floor() as usize;
    (0..length)
        .map(|_| (lcg.next_signed() * amplitude) as f32)
        .collect()
}

pub struct Simulation {
    pub bpm: f64,
    pub section_frames: HashMap<Section, usize>,
    pub hit_times: Vec<f64>,
}

pub fn simulate() -> Simulation {
    let mut simulator = Simulator::new();
    let mut beat = BeatTracker::new();
    let mut section = SectionTracker::new();
    simulator.reset(0.0);

    let mut run = Simulation {
        bpm: 0.0,
        section_frames: HashMap::new(),
        hit_times: Vec::new(),
    };
    let dt = FRAME_MS / 1000.0;
    let mut now = 0.0;
    while now < SIMULATED_SECONDS * 1000.0 {
        let levels = simulator.read(now);
        let state = beat.push(levels.sub, now, dt);
        let current = section.push(levels, state.hit, now, dt);
        *run.section_frames.entry(current).or_default() += 1;
        if state.hit {
            run.hit_times.push(now);
        }
        if state.bpm != 0.0 {
            run.bpm = state.bpm;
        }
        now += FRAME_MS;
    }
    run
}

pub fn gaps(hit_times: &[f64]) -> Vec<f64> {
    hit_times.windows(2).map(|pair| pair[1] - pair[0]).collect()
}
