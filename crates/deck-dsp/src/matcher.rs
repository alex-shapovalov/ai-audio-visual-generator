use std::error::Error;
use std::fmt;

use crate::downsample::MATCH_RATE;
use crate::fingerprint::fingerprint;

const OFFSET_BIAS: i64 = 1 << 18;
const OFFSET_SPAN: i64 = 1 << 19;
const WINDOW_SECONDS: usize = 6;
const MIN_BUFFER_SECONDS: usize = 3;
const RUN_EVERY_SECONDS: usize = 1;
pub const MIN_SCORE: u32 = 8;
pub const DOMINANCE: f64 = 1.4;
pub const CONFIRM_STREAK: u32 = 2;

const WINDOW_SAMPLES: usize = MATCH_RATE as usize * WINDOW_SECONDS;
const MIN_BUFFER_SAMPLES: usize = MATCH_RATE as usize * MIN_BUFFER_SECONDS;
const RUN_EVERY_SAMPLES: usize = MATCH_RATE as usize * RUN_EVERY_SECONDS;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LibraryError {
    LengthMismatch {
        id: String,
        hashes: usize,
        times: usize,
    },
}

impl fmt::Display for LibraryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LengthMismatch { id, hashes, times } => {
                write!(formatter, "cue {id} has {hashes} hashes but {times} times")
            }
        }
    }
}

impl Error for LibraryError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RawMatch {
    pub cue: Option<usize>,
    pub score: u32,
    pub runner_up: u32,
}

#[derive(Clone, Copy)]
struct Entry {
    hash: u32,
    cue: u32,
    time: u32,
}

#[derive(Default)]
pub struct LibraryBuilder {
    ids: Vec<String>,
    entries: Vec<Entry>,
}

impl LibraryBuilder {
    pub fn add_cue(
        &mut self,
        id: impl Into<String>,
        hashes: &[u32],
        times: &[u32],
    ) -> Result<(), LibraryError> {
        let id = id.into();
        if hashes.len() != times.len() {
            return Err(LibraryError::LengthMismatch {
                id,
                hashes: hashes.len(),
                times: times.len(),
            });
        }
        let cue = self.ids.len() as u32;
        self.ids.push(id);
        self.entries
            .extend(
                hashes
                    .iter()
                    .zip(times)
                    .map(|(&hash, &time)| Entry { hash, cue, time }),
            );
        Ok(())
    }

    pub fn build(mut self) -> Library {
        self.entries.sort_unstable_by_key(|entry| entry.hash);
        Library {
            ids: self.ids,
            entries: self.entries,
        }
    }
}

#[derive(Default)]
pub struct Library {
    ids: Vec<String>,
    entries: Vec<Entry>,
}

#[derive(Clone, Copy)]
struct Run {
    key: u64,
    count: u32,
}

impl Library {
    pub fn cue_count(&self) -> usize {
        self.ids.len()
    }

    pub fn cue_id(&self, cue: usize) -> Option<&str> {
        self.ids.get(cue).map(String::as_str)
    }

    pub fn match_samples(&self, samples: &[f32]) -> RawMatch {
        if self.ids.is_empty() {
            return RawMatch {
                cue: None,
                score: 0,
                runner_up: 0,
            };
        }
        let live = fingerprint(samples);
        let runs = count_runs(self.offset_keys(&live.hashes, &live.times));
        rank(&best_scores(&runs, self.ids.len()))
    }

    fn bucket(&self, hash: u32) -> &[Entry] {
        let start = self.entries.partition_point(|entry| entry.hash < hash);
        let length = self.entries[start..].partition_point(|entry| entry.hash == hash);
        &self.entries[start..start + length]
    }

    fn offset_keys(&self, hashes: &[u32], times: &[u32]) -> Vec<u64> {
        let mut keys = Vec::new();
        for (&hash, &live_time) in hashes.iter().zip(times) {
            for entry in self.bucket(hash) {
                let offset = i64::from(entry.time) - i64::from(live_time) + OFFSET_BIAS;
                if (1..OFFSET_SPAN - 1).contains(&offset) {
                    keys.push(u64::from(entry.cue) * OFFSET_SPAN as u64 + offset as u64);
                }
            }
        }
        keys
    }
}

fn count_runs(mut keys: Vec<u64>) -> Vec<Run> {
    keys.sort_unstable();
    let mut runs: Vec<Run> = Vec::new();
    for key in keys {
        match runs.last_mut() {
            Some(run) if run.key == key => run.count += 1,
            _ => runs.push(Run { key, count: 1 }),
        }
    }
    runs
}

fn best_scores(runs: &[Run], cue_count: usize) -> Vec<u32> {
    let mut best = vec![0; cue_count];
    for (index, run) in runs.iter().enumerate() {
        let before = index
            .checked_sub(1)
            .map(|previous| runs[previous])
            .filter(|previous| previous.key + 1 == run.key)
            .map_or(0, |previous| previous.count);
        let after = runs
            .get(index + 1)
            .filter(|next| next.key == run.key + 1)
            .map_or(0, |next| next.count);
        let cue = (run.key / OFFSET_SPAN as u64) as usize;
        best[cue] = best[cue].max(run.count + before + after);
    }
    best
}

fn rank(best: &[u32]) -> RawMatch {
    let mut winner = None;
    let mut top = 0;
    let mut second = 0;
    for (cue, &score) in best.iter().enumerate() {
        if score > top {
            second = top;
            top = score;
            winner = Some(cue);
        } else if score > second {
            second = score;
        }
    }
    RawMatch {
        cue: winner,
        score: top,
        runner_up: second,
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MatchStatus {
    pub candidate_id: Option<String>,
    pub confirmed: bool,
    pub score: u32,
    pub runner_up: u32,
    pub listened_seconds: f32,
}

pub struct LiveMatcher {
    library: Library,
    buffer: Vec<f32>,
    filled: usize,
    since_run: usize,
    last_candidate: Option<usize>,
    streak: u32,
}

impl Default for LiveMatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl LiveMatcher {
    pub fn new() -> Self {
        Self {
            library: Library::default(),
            buffer: vec![0.0; WINDOW_SAMPLES],
            filled: 0,
            since_run: 0,
            last_candidate: None,
            streak: 0,
        }
    }

    pub fn set_library(&mut self, library: Library) {
        self.library = library;
        self.last_candidate = None;
        self.streak = 0;
    }

    pub fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.filled = 0;
        self.since_run = 0;
        self.last_candidate = None;
        self.streak = 0;
    }

    pub fn push(&mut self, chunk: &[f32]) -> Option<MatchStatus> {
        self.append(chunk);
        self.filled = (self.filled + chunk.len()).min(WINDOW_SAMPLES);
        self.since_run += chunk.len();
        if self.filled < MIN_BUFFER_SAMPLES || self.since_run < RUN_EVERY_SAMPLES {
            return None;
        }
        self.since_run = 0;
        Some(self.evaluate())
    }

    fn append(&mut self, chunk: &[f32]) {
        let size = self.buffer.len();
        if chunk.len() >= size {
            self.buffer.copy_from_slice(&chunk[chunk.len() - size..]);
        } else {
            self.buffer.copy_within(chunk.len().., 0);
            self.buffer[size - chunk.len()..].copy_from_slice(chunk);
        }
    }

    fn evaluate(&mut self) -> MatchStatus {
        let recent = &self.buffer[self.buffer.len() - self.filled..];
        let raw = self.library.match_samples(recent);
        let decisive = is_decisive(&raw);

        if decisive && raw.cue == self.last_candidate {
            self.streak += 1;
        } else {
            self.streak = u32::from(decisive);
        }
        self.last_candidate = if decisive { raw.cue } else { None };

        MatchStatus {
            candidate_id: self
                .last_candidate
                .and_then(|cue| self.library.cue_id(cue))
                .map(str::to_owned),
            confirmed: decisive && self.streak >= CONFIRM_STREAK,
            score: raw.score,
            runner_up: raw.runner_up,
            listened_seconds: self.filled as f32 / MATCH_RATE as f32,
        }
    }
}

fn is_decisive(raw: &RawMatch) -> bool {
    raw.cue.is_some()
        && raw.score >= MIN_SCORE
        && (raw.runner_up == 0 || f64::from(raw.score) >= f64::from(raw.runner_up) * DOMINANCE)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(cue: u64, offset: u64, count: u32) -> Run {
        Run {
            key: cue * OFFSET_SPAN as u64 + offset,
            count,
        }
    }

    #[test]
    fn a_score_adds_the_neighboring_offsets_on_both_sides() {
        let runs = [run(0, 100, 3), run(0, 101, 5), run(0, 102, 2)];
        assert_eq!(best_scores(&runs, 1), [10]);
    }

    #[test]
    fn offsets_two_frames_apart_do_not_add_up() {
        let runs = [run(0, 100, 3), run(0, 102, 5)];
        assert_eq!(best_scores(&runs, 1), [5]);
    }

    #[test]
    fn each_cue_keeps_its_own_best_score() {
        let runs = [run(0, 50, 4), run(1, 10, 2), run(1, 11, 7), run(2, 300, 5)];
        assert_eq!(best_scores(&runs, 3), [4, 9, 5]);
    }
}
