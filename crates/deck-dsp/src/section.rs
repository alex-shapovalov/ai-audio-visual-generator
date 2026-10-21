use std::collections::VecDeque;

use crate::bands::BandLevels;

const KICKLESS_LEVEL: f64 = 0.25;
const KICKLESS_HOLD_MS: f64 = 1200.0;
const MUSIC_PRESENT: f64 = 0.08;
const BUILD_RISE: f64 = 0.12;
const HISTORY_MS: f64 = 4000.0;
const DROP_HOLD_MS: f64 = 3500.0;
const DROP_LEVEL: f64 = 0.6;
const SUB_SMOOTH_TAU: f64 = 0.5;
const ENERGY_SMOOTH_TAU: f64 = 0.7;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Section {
    #[default]
    Groove,
    Breakdown,
    Build,
    Drop,
}

impl Section {
    pub fn index(self) -> u8 {
        match self {
            Self::Groove => 0,
            Self::Breakdown => 1,
            Self::Build => 2,
            Self::Drop => 3,
        }
    }
}

#[derive(Clone, Copy)]
struct EnergySample {
    at_ms: f64,
    energy: f64,
}

#[derive(Default)]
pub struct SectionTracker {
    state: Section,
    sub_smooth: f64,
    energy_smooth: f64,
    history: VecDeque<EnergySample>,
    kickless_since: Option<f64>,
    drop_until: f64,
}

impl SectionTracker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, levels: BandLevels, hit: bool, now_ms: f64, dt: f64) -> Section {
        self.smooth(levels, dt);
        self.remember(now_ms);

        if self.state == Section::Drop && now_ms > self.drop_until {
            self.state = Section::Groove;
        }
        self.track_kickless(now_ms);
        self.detect_build();
        self.detect_drop(levels, hit, now_ms);
        self.state
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }

    fn smooth(&mut self, levels: BandLevels, dt: f64) {
        self.sub_smooth += (levels.sub - self.sub_smooth) * (1.0 - (-dt / SUB_SMOOTH_TAU).exp());
        let energy = (levels.low + levels.mid + levels.air) / 3.0;
        self.energy_smooth +=
            (energy - self.energy_smooth) * (1.0 - (-dt / ENERGY_SMOOTH_TAU).exp());
    }

    fn remember(&mut self, now_ms: f64) {
        self.history.push_back(EnergySample {
            at_ms: now_ms,
            energy: self.energy_smooth,
        });
        while self.history.len() > 1
            && self
                .history
                .front()
                .is_some_and(|oldest| now_ms - oldest.at_ms > HISTORY_MS)
        {
            self.history.pop_front();
        }
    }

    fn track_kickless(&mut self, now_ms: f64) {
        let kickless = self.sub_smooth < KICKLESS_LEVEL && self.energy_smooth > MUSIC_PRESENT;
        if !kickless {
            self.kickless_since = None;
            return;
        }
        let since = *self.kickless_since.get_or_insert(now_ms);
        if self.state == Section::Groove && now_ms - since > KICKLESS_HOLD_MS {
            self.state = Section::Breakdown;
        }
    }

    fn detect_build(&mut self) {
        if self.state != Section::Breakdown {
            return;
        }
        let oldest = self
            .history
            .front()
            .map_or(self.energy_smooth, |sample| sample.energy);
        if self.energy_smooth - oldest > BUILD_RISE {
            self.state = Section::Build;
        }
    }

    fn detect_drop(&mut self, levels: BandLevels, hit: bool, now_ms: f64) {
        let arranged = matches!(self.state, Section::Breakdown | Section::Build);
        if arranged && hit && levels.sub > DROP_LEVEL {
            self.state = Section::Drop;
            self.drop_until = now_ms + DROP_HOLD_MS;
        }
    }
}
