use deck_dsp::{Analyzer, BandReader, BeatTracker, Section};

use crate::common::{FRAME_MS, Lcg, gaps, simulate};

const ALL_SECTIONS: [Section; 4] = [
    Section::Groove,
    Section::Breakdown,
    Section::Build,
    Section::Drop,
];

#[test]
fn simulator_locks_the_tempo() {
    let run = simulate();
    assert!(run.bpm > 125.0 && run.bpm < 131.0, "bpm {}", run.bpm);
}

#[test]
fn simulator_yields_roughly_one_kick_per_beat() {
    let gaps = gaps(&simulate().hit_times);
    let regular = gaps
        .iter()
        .filter(|&&gap| (gap - 468.75).abs() < 40.0)
        .count();
    assert!(regular as f64 / gaps.len() as f64 > 0.6);
}

#[test]
fn kick_detection_never_exceeds_the_strobe_safe_rate() {
    let hit_times = simulate().hit_times;
    assert!(hit_times.len() > 10);
    let shortest = gaps(&hit_times).into_iter().fold(f64::INFINITY, f64::min);
    assert!(shortest >= 240.0, "shortest gap {shortest}");
}

#[test]
fn simulator_moves_through_every_section() {
    let frames = simulate().section_frames;
    for section in ALL_SECTIONS {
        assert!(frames.contains_key(&section), "{section:?} never occurred");
    }
}

#[test]
fn the_minimum_gap_holds_for_any_frame_rate_and_input_pattern() {
    for frame_ms in [1.0, 4.0, 1000.0 / 144.0, 1000.0 / 60.0, 1000.0 / 30.0] {
        let mut beat = BeatTracker::new();
        let mut hit_times = Vec::new();
        let mut now = 0.0;
        let mut frame_index = 0_u32;
        while now < 20_000.0 {
            let sub = if frame_index % 3 == 0 { 1.0 } else { 0.0 };
            if beat.push(sub, now, frame_ms / 1000.0).hit {
                hit_times.push(now);
            }
            now += frame_ms;
            frame_index += 1;
        }
        assert!(hit_times.len() > 10, "too few hits at {frame_ms} ms frames");
        let shortest = gaps(&hit_times).into_iter().fold(f64::INFINITY, f64::min);
        assert!(
            shortest >= 240.0,
            "shortest gap {shortest} at {frame_ms} ms frames"
        );
    }
}

#[test]
fn weak_sub_fluctuations_never_register_as_kicks() {
    let mut beat = BeatTracker::new();
    let mut lcg = Lcg::new(7);
    let mut now = 0.0;
    let mut hits = 0;
    while now < 20_000.0 {
        let sub = (lcg.next_signed() + 1.0) / 2.0 * 0.4;
        if beat.push(sub, now, FRAME_MS / 1000.0).hit {
            hits += 1;
        }
        now += FRAME_MS;
    }
    assert_eq!(hits, 0);
}

#[test]
fn analyzer_in_simulated_mode_locks_the_tempo_and_reaches_every_section() {
    let mut analyzer = Analyzer::new(48_000.0, 1024);
    analyzer.reset_simulator(0.0);
    let mut seen = Vec::new();
    let mut now = 0.0;
    while now < 60_000.0 {
        analyzer.tick_simulated(now, FRAME_MS / 1000.0);
        let section = analyzer.frame().section;
        if !seen.contains(&section) {
            seen.push(section);
        }
        now += FRAME_MS;
    }
    let bpm = analyzer.frame().bpm;
    assert!(bpm > 125.0 && bpm < 131.0, "bpm {bpm}");
    for section in ALL_SECTIONS {
        assert!(seen.contains(&section), "{section:?} never occurred");
    }
}

#[test]
fn idle_ticks_decay_the_last_levels_by_a_factor_of_five_per_second() {
    let mut analyzer = Analyzer::new(48_000.0, 1024);
    let mut spectrum = vec![-120.0_f32; 1024];
    spectrum[3] = -10.0;
    analyzer.tick(&spectrum, 0.0, 1.0 / 60.0);
    let before = analyzer.frame().levels.sub;
    assert!(before > 0.9);

    for step in 1..=60 {
        analyzer.tick_idle(f64::from(step) * FRAME_MS, 1.0 / 60.0);
    }
    let after = analyzer.frame().levels.sub;
    assert!(
        (after / before - 0.2).abs() < 0.01,
        "ratio {}",
        after / before
    );
}

mod band_reader {
    use super::BandReader;

    const SAMPLE_RATE: f64 = 48_000.0;
    const BINS: usize = 1024;

    fn tone(hz: f64, decibels: f32) -> Vec<f32> {
        let bin_width = SAMPLE_RATE / 2.0 / BINS as f64;
        let mut spectrum = vec![-120.0; BINS];
        spectrum[(hz / bin_width).round() as usize] = decibels;
        spectrum
    }

    #[test]
    fn energy_lands_in_the_correct_band_and_normalizes_to_the_running_peak() {
        let mut reader = BandReader::new(SAMPLE_RATE, BINS);
        let bass = reader.read(&tone(60.0, -10.0), 1.0 / 60.0);
        assert!((bass.sub - 1.0).abs() < 0.05);
        assert!(bass.mid < 0.01);
        assert!(bass.air < 0.01);

        let treble = reader.read(&tone(5000.0, -10.0), 1.0 / 60.0);
        assert!((treble.air - 1.0).abs() < 0.05);
        assert!(treble.sub < 0.01);
    }

    #[test]
    fn a_quieter_hit_scales_relative_to_the_recent_peak() {
        let mut reader = BandReader::new(SAMPLE_RATE, BINS);
        reader.read(&tone(60.0, -10.0), 1.0 / 60.0);
        let quiet = reader.read(&tone(60.0, -26.0), 1.0 / 60.0);
        assert!(quiet.sub > 0.1 && quiet.sub < 0.3, "sub {}", quiet.sub);
    }

    #[test]
    fn a_short_spectrum_is_read_as_silence_instead_of_panicking() {
        let mut reader = BandReader::new(SAMPLE_RATE, BINS);
        let levels = reader.read(&[-10.0; 8], 1.0 / 60.0);
        assert!(levels.air < 0.01);
    }
}
