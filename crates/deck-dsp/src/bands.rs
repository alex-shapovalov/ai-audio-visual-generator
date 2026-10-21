const BAND_COUNT: usize = 4;
const EDGES_HZ: [(f64, f64); BAND_COUNT] = [
    (30.0, 90.0),
    (90.0, 250.0),
    (250.0, 2000.0),
    (2000.0, 10000.0),
];
const FLOOR: f64 = 0.0005;
const PEAK_DECAY_PER_SECOND: f64 = 0.96;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BandLevels {
    pub sub: f64,
    pub low: f64,
    pub mid: f64,
    pub air: f64,
}

impl BandLevels {
    pub fn scaled(self, factor: f64) -> Self {
        Self {
            sub: self.sub * factor,
            low: self.low * factor,
            mid: self.mid * factor,
            air: self.air * factor,
        }
    }
}

pub struct BandReader {
    ranges: [(usize, usize); BAND_COUNT],
    peaks: [f64; BAND_COUNT],
}

impl BandReader {
    pub fn new(sample_rate: f64, bin_count: usize) -> Self {
        let bin_width = sample_rate / 2.0 / bin_count as f64;
        Self {
            ranges: EDGES_HZ.map(|(low, high)| bin_range(low, high, bin_width, bin_count)),
            peaks: [FLOOR; BAND_COUNT],
        }
    }

    pub fn read(&mut self, decibels: &[f32], dt: f64) -> BandLevels {
        let decay = PEAK_DECAY_PER_SECOND.powf(dt);
        let mut levels = [0.0; BAND_COUNT];
        for (band, &(first, last)) in self.ranges.iter().enumerate() {
            let level = mean_amplitude(decibels, first, last);
            self.peaks[band] = level.max(self.peaks[band] * decay).max(FLOOR);
            levels[band] = (level / self.peaks[band]).min(1.0);
        }
        BandLevels {
            sub: levels[0],
            low: levels[1],
            mid: levels[2],
            air: levels[3],
        }
    }
}

fn bin_range(low_hz: f64, high_hz: f64, bin_width: f64, bin_count: usize) -> (usize, usize) {
    let first = ((low_hz / bin_width).floor() as usize)
        .max(1)
        .min(bin_count.saturating_sub(1));
    let last = ((high_hz / bin_width).ceil() as usize)
        .max(first + 1)
        .min(bin_count);
    (first, last)
}

fn mean_amplitude(decibels: &[f32], first: usize, last: usize) -> f64 {
    let width = last.saturating_sub(first).max(1);
    let total: f64 = decibels
        .iter()
        .skip(first)
        .take(width)
        .map(|&level| 10f64.powf(f64::from(level) / 20.0))
        .sum();
    total / width as f64
}
