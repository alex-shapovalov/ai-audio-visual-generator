use crate::bands::BandLevels;

const BPM: f64 = 128.0;
const BEATS_PER_BAR: f64 = 4.0;
const BARS_PER_CYCLE: f64 = 16.0;
const BREAKDOWN_START: u32 = 8;
const DROP_BAR: u32 = 12;

#[derive(Default)]
pub struct Simulator {
    started_at_ms: f64,
}

impl Simulator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self, now_ms: f64) {
        self.started_at_ms = now_ms;
    }

    pub fn read(&self, now_ms: f64) -> BandLevels {
        let seconds = (now_ms - self.started_at_ms) / 1000.0;
        let beats = seconds / (60.0 / BPM);
        let beat_phase = beats.rem_euclid(1.0);
        let bar = (beats / BEATS_PER_BAR).floor().rem_euclid(BARS_PER_CYCLE) as u32;

        let arranged = (BREAKDOWN_START..DROP_BAR).contains(&bar);
        let building = bar == DROP_BAR - 1;
        let dropped = bar >= DROP_BAR;

        let kick = if arranged {
            0.0
        } else {
            (-beat_phase * 7.0).exp()
        };
        let hat = (-(beats + 0.5).rem_euclid(1.0) * 14.0).exp();
        let ramp = if building {
            (beats.rem_euclid(BEATS_PER_BAR) / BEATS_PER_BAR) * 0.5
        } else {
            0.0
        };

        let sub_floor = if dropped { 0.18 } else { 0.05 };
        let low_boost = if dropped { 0.2 } else { 0.0 };
        let mid_base = if arranged { 0.6 } else { 0.35 };
        let air_base = if arranged { 0.25 } else { 0.1 };

        BandLevels {
            sub: (kick * 0.95 + sub_floor).min(1.0),
            low: 0.25 + kick * 0.3 + low_boost,
            mid: mid_base + 0.1 * (seconds * 3.0).sin() + ramp,
            air: (hat * 0.6 + air_base + ramp).min(1.0),
        }
    }
}
