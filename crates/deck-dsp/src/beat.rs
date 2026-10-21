use std::collections::VecDeque;

const HISTORY: usize = 60;
pub const MIN_GAP_MS: f64 = 240.0;
const MIN_LEVEL: f64 = 0.45;
const SENSITIVITY: f64 = 1.3;
const ENVELOPE_TAU: f64 = 0.12;
const MAX_GAPS: usize = 8;
const MIN_GAPS_FOR_TEMPO: usize = 4;
const MAX_TEMPO_GAP_MS: f64 = 1500.0;
const MIN_BPM: f64 = 80.0;
const MAX_BPM: f64 = 175.0;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BeatState {
    pub envelope: f64,
    pub hit: bool,
    pub bpm: f64,
}

pub struct BeatTracker {
    history: VecDeque<f64>,
    previous: f64,
    last_hit: f64,
    gaps: VecDeque<f64>,
    envelope: f64,
    bpm: f64,
}

impl Default for BeatTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl BeatTracker {
    pub fn new() -> Self {
        Self {
            history: VecDeque::with_capacity(HISTORY + 1),
            previous: 0.0,
            last_hit: f64::NEG_INFINITY,
            gaps: VecDeque::with_capacity(MAX_GAPS + 1),
            envelope: 0.0,
            bpm: 0.0,
        }
    }

    pub fn push(&mut self, sub: f64, now_ms: f64, dt: f64) -> BeatState {
        self.record(sub);
        let hit = self.is_hit(sub, now_ms);

        self.envelope *= (-dt / ENVELOPE_TAU).exp();
        if hit {
            self.envelope = 1.0;
            self.record_gap(now_ms - self.last_hit);
            self.last_hit = now_ms;
        }
        self.previous = sub;
        BeatState {
            envelope: self.envelope,
            hit,
            bpm: self.bpm,
        }
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }

    fn record(&mut self, sub: f64) {
        self.history.push_back(sub);
        if self.history.len() > HISTORY {
            self.history.pop_front();
        }
    }

    fn is_hit(&self, sub: f64, now_ms: f64) -> bool {
        let (average, deviation) = mean_and_deviation(&self.history);
        sub > self.previous
            && sub > MIN_LEVEL
            && sub > average + deviation * SENSITIVITY
            && now_ms - self.last_hit > MIN_GAP_MS
    }

    fn record_gap(&mut self, gap_ms: f64) {
        if gap_ms >= MAX_TEMPO_GAP_MS {
            return;
        }
        self.gaps.push_back(gap_ms);
        if self.gaps.len() > MAX_GAPS {
            self.gaps.pop_front();
        }
        if self.gaps.len() >= MIN_GAPS_FOR_TEMPO {
            self.bpm = fold_bpm(60_000.0 / median(&self.gaps));
        }
    }
}

fn mean_and_deviation(values: &VecDeque<f64>) -> (f64, f64) {
    if values.is_empty() {
        return (0.0, 0.0);
    }
    let count = values.len() as f64;
    let average = values.iter().sum::<f64>() / count;
    let variance = values
        .iter()
        .map(|value| (value - average).powi(2))
        .sum::<f64>()
        / count;
    (average, variance.sqrt())
}

fn median(values: &VecDeque<f64>) -> f64 {
    let mut sorted: Vec<f64> = values.iter().copied().collect();
    sorted.sort_by(f64::total_cmp);
    sorted[sorted.len() / 2]
}

fn fold_bpm(bpm: f64) -> f64 {
    let mut folded = bpm;
    while folded < MIN_BPM {
        folded *= 2.0;
    }
    while folded > MAX_BPM {
        folded /= 2.0;
    }
    folded
}
