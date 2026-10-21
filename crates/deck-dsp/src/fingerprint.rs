use crate::downsample::MATCH_RATE;
use crate::fft::Fft;
use crate::window::hann;

pub const FFT_SIZE: usize = 1024;
pub const HOP: usize = 256;
pub const FRAMES_PER_SECOND: f64 = MATCH_RATE as f64 / HOP as f64;

const BINS: usize = FFT_SIZE / 2;
const BAND_EDGES: [usize; 8] = [2, 6, 14, 30, 62, 126, 254, 510];
const BAND_COUNT: usize = BAND_EDGES.len() - 1;
const MIN_MAGNITUDE: f64 = 0.5;
const RELATIVE_THRESHOLD: f64 = 0.75;
const MIN_DT: u32 = 3;
const MAX_DT: u32 = 63;
const FAN_OUT: usize = 5;
const LOW_BIN_LIMIT: usize = 14;
const HIGH_BIN_START: usize = 62;
const MIN_FRAMES: usize = 3;
const ANCHOR_SHIFT: u32 = 15;
const TARGET_SHIFT: u32 = 6;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TrackStats {
    pub duration: f64,
    pub brightness: f64,
    pub bass: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Fingerprint {
    pub hashes: Vec<u32>,
    pub times: Vec<u32>,
    pub stats: TrackStats,
}

#[derive(Clone, Copy)]
struct Peak {
    time: u32,
    bin: usize,
}

#[derive(Default)]
struct Energy {
    total: f64,
    low: f64,
    high: f64,
}

impl Energy {
    fn add_frame(&mut self, spectrum: &[f32]) {
        for (bin, &magnitude) in spectrum.iter().enumerate().skip(BAND_EDGES[0]) {
            let magnitude = f64::from(magnitude);
            self.total += magnitude;
            if bin < LOW_BIN_LIMIT {
                self.low += magnitude;
            }
            if bin >= HIGH_BIN_START {
                self.high += magnitude;
            }
        }
    }

    fn bass_and_brightness(&self) -> (f64, f64) {
        let divisor = if self.total == 0.0 { 1.0 } else { self.total };
        (self.low / divisor, self.high / divisor)
    }
}

struct SpectrumSource<'a> {
    samples: &'a [f32],
    fft: Fft,
    window: Vec<f32>,
    scratch: Vec<f32>,
}

impl<'a> SpectrumSource<'a> {
    fn new(samples: &'a [f32]) -> Self {
        Self {
            samples,
            fft: Fft::new(FFT_SIZE),
            window: hann(FFT_SIZE),
            scratch: vec![0.0; FFT_SIZE],
        }
    }

    fn frame(&mut self, index: usize, out: &mut [f32]) {
        let start = index * HOP;
        let slice = &self.samples[start..start + FFT_SIZE];
        for ((slot, &sample), &taper) in self.scratch.iter_mut().zip(slice).zip(&self.window) {
            *slot = sample * taper;
        }
        self.fft.magnitudes(&self.scratch, out);
    }
}

fn frame_count(sample_count: usize) -> usize {
    if sample_count < FFT_SIZE {
        0
    } else {
        (sample_count - FFT_SIZE) / HOP + 1
    }
}

fn strongest_bin(spectrum: &[f32], start: usize, end: usize) -> usize {
    let mut best = start;
    for bin in start..end {
        if spectrum[bin] > spectrum[best] {
            best = bin;
        }
    }
    best
}

fn is_peak(bin: usize, average: f64, previous: &[f32], current: &[f32], next: &[f32]) -> bool {
    let magnitude = current[bin];
    f64::from(magnitude) > MIN_MAGNITUDE
        && f64::from(magnitude) >= average * RELATIVE_THRESHOLD
        && magnitude >= previous[bin]
        && magnitude >= next[bin]
        && magnitude >= current[bin - 1]
        && magnitude >= current[bin + 1]
}

fn collect_frame_peaks(
    time: u32,
    previous: &[f32],
    current: &[f32],
    next: &[f32],
    peaks: &mut Vec<Peak>,
) {
    let strongest: [usize; BAND_COUNT] =
        std::array::from_fn(|band| strongest_bin(current, BAND_EDGES[band], BAND_EDGES[band + 1]));
    let average = strongest
        .iter()
        .map(|&bin| f64::from(current[bin]))
        .sum::<f64>()
        / BAND_COUNT as f64;
    for &bin in &strongest {
        if is_peak(bin, average, previous, current, next) {
            peaks.push(Peak { time, bin });
        }
    }
}

fn scan_peaks(samples: &[f32], frames: usize) -> (Vec<Peak>, Energy) {
    let mut source = SpectrumSource::new(samples);
    let mut previous = vec![0.0; BINS];
    let mut current = vec![0.0; BINS];
    let mut next = vec![0.0; BINS];
    source.frame(0, &mut previous);
    source.frame(1, &mut current);

    let mut peaks = Vec::new();
    let mut energy = Energy::default();
    for time in 1..frames - 1 {
        source.frame(time + 1, &mut next);
        energy.add_frame(&current);
        collect_frame_peaks(time as u32, &previous, &current, &next, &mut peaks);
        std::mem::swap(&mut previous, &mut current);
        std::mem::swap(&mut current, &mut next);
    }
    (peaks, energy)
}

fn pack_hash(anchor: usize, target: usize, dt: u32) -> u32 {
    ((anchor as u32) << ANCHOR_SHIFT) | ((target as u32) << TARGET_SHIFT) | dt
}

fn pair_peaks(peaks: &[Peak]) -> (Vec<u32>, Vec<u32>) {
    let mut hashes = Vec::new();
    let mut times = Vec::new();
    for (index, anchor) in peaks.iter().enumerate() {
        let mut paired = 0;
        for target in &peaks[index + 1..] {
            if paired >= FAN_OUT {
                break;
            }
            let dt = target.time - anchor.time;
            if dt < MIN_DT {
                continue;
            }
            if dt > MAX_DT {
                break;
            }
            hashes.push(pack_hash(anchor.bin, target.bin, dt));
            times.push(anchor.time);
            paired += 1;
        }
    }
    (hashes, times)
}

pub fn fingerprint(samples: &[f32]) -> Fingerprint {
    let frames = frame_count(samples.len());
    let (peaks, energy) = if frames >= MIN_FRAMES {
        scan_peaks(samples, frames)
    } else {
        (Vec::new(), Energy::default())
    };
    let (hashes, times) = pair_peaks(&peaks);
    let (bass, brightness) = energy.bass_and_brightness();
    Fingerprint {
        hashes,
        times,
        stats: TrackStats {
            duration: samples.len() as f64 / f64::from(MATCH_RATE),
            brightness,
            bass,
        },
    }
}
