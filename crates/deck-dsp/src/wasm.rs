use wasm_bindgen::prelude::*;

use crate::analyzer::Analyzer;
use crate::downsample::Downsampler;
use crate::fingerprint::{Fingerprint, fingerprint};
use crate::matcher::{LibraryBuilder, LiveMatcher, MatchStatus};
use crate::synth::{DEMO_TRACKS, render_track};

#[wasm_bindgen(js_name = Analyzer)]
pub struct WasmAnalyzer {
    inner: Analyzer,
}

#[wasm_bindgen(js_class = Analyzer)]
impl WasmAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, bin_count: u32) -> WasmAnalyzer {
        WasmAnalyzer {
            inner: Analyzer::new(f64::from(sample_rate), bin_count as usize),
        }
    }

    pub fn tick(&mut self, spectrum_db: &[f32], now_ms: f64, dt: f32) {
        self.inner.tick(spectrum_db, now_ms, f64::from(dt));
    }

    pub fn tick_idle(&mut self, now_ms: f64, dt: f32) {
        self.inner.tick_idle(now_ms, f64::from(dt));
    }

    pub fn tick_simulated(&mut self, now_ms: f64, dt: f32) {
        self.inner.tick_simulated(now_ms, f64::from(dt));
    }

    pub fn reset_simulator(&mut self, now_ms: f64) {
        self.inner.reset_simulator(now_ms);
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }

    pub fn frame(&self) -> Vec<f32> {
        let frame = self.inner.frame();
        vec![
            frame.levels.sub as f32,
            frame.levels.low as f32,
            frame.levels.mid as f32,
            frame.levels.air as f32,
            frame.kick as f32,
            frame.bpm as f32,
            f32::from(frame.section.index()),
        ]
    }
}

#[wasm_bindgen(js_name = Downsampler)]
pub struct WasmDownsampler {
    inner: Downsampler,
}

#[wasm_bindgen(js_class = Downsampler)]
impl WasmDownsampler {
    #[wasm_bindgen(constructor)]
    pub fn new(input_rate: f32) -> WasmDownsampler {
        WasmDownsampler {
            inner: Downsampler::new(f64::from(input_rate)),
        }
    }

    pub fn push(&mut self, input: &[f32]) -> Vec<f32> {
        self.inner.push(input)
    }
}

#[wasm_bindgen(js_name = Fingerprint)]
pub struct WasmFingerprint {
    inner: Fingerprint,
}

#[wasm_bindgen(js_class = Fingerprint)]
impl WasmFingerprint {
    #[wasm_bindgen(getter)]
    pub fn hashes(&self) -> Vec<u32> {
        self.inner.hashes.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn times(&self) -> Vec<u32> {
        self.inner.times.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn duration(&self) -> f32 {
        self.inner.stats.duration as f32
    }

    #[wasm_bindgen(getter)]
    pub fn brightness(&self) -> f32 {
        self.inner.stats.brightness as f32
    }

    #[wasm_bindgen(getter)]
    pub fn bass(&self) -> f32 {
        self.inner.stats.bass as f32
    }
}

#[wasm_bindgen(js_name = fingerprint)]
pub fn fingerprint_samples(samples: &[f32]) -> WasmFingerprint {
    WasmFingerprint {
        inner: fingerprint(samples),
    }
}

#[wasm_bindgen(js_name = MatchStatus)]
pub struct WasmMatchStatus {
    inner: MatchStatus,
}

#[wasm_bindgen(js_class = MatchStatus)]
impl WasmMatchStatus {
    #[wasm_bindgen(getter)]
    pub fn candidate_id(&self) -> Option<String> {
        self.inner.candidate_id.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn confirmed(&self) -> bool {
        self.inner.confirmed
    }

    #[wasm_bindgen(getter)]
    pub fn score(&self) -> u32 {
        self.inner.score
    }

    #[wasm_bindgen(getter)]
    pub fn runner_up(&self) -> u32 {
        self.inner.runner_up
    }

    #[wasm_bindgen(getter)]
    pub fn listened_seconds(&self) -> f32 {
        self.inner.listened_seconds
    }
}

#[wasm_bindgen(js_name = Matcher)]
pub struct WasmMatcher {
    builder: LibraryBuilder,
    live: LiveMatcher,
}

impl Default for WasmMatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen(js_class = Matcher)]
impl WasmMatcher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmMatcher {
        WasmMatcher {
            builder: LibraryBuilder::default(),
            live: LiveMatcher::new(),
        }
    }

    pub fn clear_library(&mut self) {
        self.builder = LibraryBuilder::default();
    }

    pub fn add_cue(&mut self, id: String, hashes: &[u32], times: &[u32]) -> Result<(), JsError> {
        self.builder.add_cue(id, hashes, times)?;
        Ok(())
    }

    pub fn finish_library(&mut self) {
        let builder = std::mem::take(&mut self.builder);
        self.live.set_library(builder.build());
    }

    pub fn push(&mut self, chunk: &[f32]) -> Option<WasmMatchStatus> {
        self.live.push(chunk).map(|inner| WasmMatchStatus { inner })
    }

    pub fn reset(&mut self) {
        self.live.reset();
    }
}

#[wasm_bindgen]
pub fn demo_track_names() -> Vec<String> {
    DEMO_TRACKS
        .iter()
        .map(|track| track.file.to_owned())
        .collect()
}

#[wasm_bindgen]
pub fn render_demo_track(index: u32, sample_rate: u32) -> Result<Vec<f32>, JsError> {
    let track = DEMO_TRACKS
        .get(index as usize)
        .ok_or_else(|| JsError::new("unknown demo track"))?;
    Ok(render_track(&track.spec, sample_rate)?)
}
