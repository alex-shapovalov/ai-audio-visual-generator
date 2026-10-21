use crate::bands::{BandLevels, BandReader};
use crate::beat::BeatTracker;
use crate::section::{Section, SectionTracker};
use crate::simulator::Simulator;

const IDLE_DECAY_PER_SECOND: f64 = 0.2;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Frame {
    pub levels: BandLevels,
    pub kick: f64,
    pub bpm: f64,
    pub section: Section,
}

pub struct Analyzer {
    bands: BandReader,
    beat: BeatTracker,
    section: SectionTracker,
    simulator: Simulator,
    frame: Frame,
}

impl Analyzer {
    pub fn new(sample_rate: f64, bin_count: usize) -> Self {
        Self {
            bands: BandReader::new(sample_rate, bin_count),
            beat: BeatTracker::new(),
            section: SectionTracker::new(),
            simulator: Simulator::new(),
            frame: Frame::default(),
        }
    }

    pub fn tick(&mut self, spectrum_db: &[f32], now_ms: f64, dt: f64) {
        let levels = self.bands.read(spectrum_db, dt);
        self.advance(levels, now_ms, dt);
    }

    pub fn tick_idle(&mut self, now_ms: f64, dt: f64) {
        let levels = self.frame.levels.scaled(IDLE_DECAY_PER_SECOND.powf(dt));
        self.advance(levels, now_ms, dt);
    }

    pub fn tick_simulated(&mut self, now_ms: f64, dt: f64) {
        let levels = self.simulator.read(now_ms);
        self.advance(levels, now_ms, dt);
    }

    pub fn reset_simulator(&mut self, now_ms: f64) {
        self.simulator.reset(now_ms);
    }

    pub fn reset(&mut self) {
        self.beat.reset();
        self.section.reset();
    }

    pub fn frame(&self) -> Frame {
        self.frame
    }

    fn advance(&mut self, levels: BandLevels, now_ms: f64, dt: f64) {
        let beat = self.beat.push(levels.sub, now_ms, dt);
        self.frame = Frame {
            levels,
            kick: beat.envelope,
            bpm: beat.bpm,
            section: self.section.push(levels, beat.hit, now_ms, dt),
        };
    }
}
