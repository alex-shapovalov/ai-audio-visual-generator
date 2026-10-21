use deck_dsp::MATCH_RATE;
use deck_dsp::fingerprint;
use deck_dsp::fingerprint::{FFT_SIZE, HOP};

use crate::common::{RATE, TRACKS};

#[test]
fn demo_track_yields_hashes_and_sane_stats() {
    let print = &TRACKS[0].print;
    assert!(print.hashes.len() > 1000);
    assert_eq!(print.hashes.len(), print.times.len());
    assert!((print.stats.duration - 48.0).abs() < 0.5);
    assert!(print.stats.bass > 0.0);
}

#[test]
fn silence_yields_no_hashes() {
    let print = fingerprint(&vec![0.0; RATE as usize * 5]);
    assert!(print.hashes.is_empty());
    assert_eq!(print.stats.bass, 0.0);
    assert_eq!(print.stats.brightness, 0.0);
}

#[test]
fn inputs_shorter_than_three_frames_yield_an_empty_fingerprint() {
    let shortest_usable = FFT_SIZE + 2 * HOP;
    for length in [0, 1, FFT_SIZE - 1, FFT_SIZE, shortest_usable - 1] {
        let print = fingerprint(&vec![0.5; length]);
        assert!(print.hashes.is_empty(), "length {length}");
        assert!(print.times.is_empty(), "length {length}");
        assert_eq!(print.stats.bass, 0.0, "length {length}");
        let expected_duration = length as f64 / f64::from(MATCH_RATE);
        assert_eq!(print.stats.duration, expected_duration, "length {length}");
    }
}

#[test]
fn hashes_pack_two_peak_bins_and_a_bounded_frame_delta() {
    let print = &TRACKS[1].print;
    for &hash in &print.hashes {
        let delta = hash & 0x3F;
        let target_bin = (hash >> 6) & 0x1FF;
        let anchor_bin = hash >> 15;
        assert!((3..=63).contains(&delta), "delta {delta}");
        assert!((2..510).contains(&target_bin), "target bin {target_bin}");
        assert!((2..510).contains(&anchor_bin), "anchor bin {anchor_bin}");
    }
}

#[test]
fn peak_times_stay_inside_the_analyzed_frames() {
    let print = &TRACKS[2].print;
    let frames = (TRACKS[2].samples.len() - FFT_SIZE) / HOP + 1;
    let first = *print.times.iter().min().expect("track has hashes");
    let last = *print.times.iter().max().expect("track has hashes");
    assert!(first >= 1);
    assert!((last as usize) < frames - 1);
}

mod pairing {
    use std::f64::consts::PI;

    use deck_dsp::fingerprint;
    use deck_dsp::fingerprint::{FFT_SIZE, HOP};
    use deck_dsp::window::hann;

    const BURST_SAMPLES: usize = 512;
    const KILOHERTZ: f64 = 1000.0;
    const SAMPLE_RATE: f64 = 11_025.0;

    fn burst_signal(bursts: &[(usize, f64)]) -> Vec<f32> {
        let last_frame = bursts.iter().map(|&(frame, _)| frame).max().unwrap_or(0);
        let mut signal = vec![0.0; FFT_SIZE + (last_frame + 3) * HOP];
        let envelope = hann(BURST_SAMPLES);
        for &(frame, hz) in bursts {
            let start = frame * HOP + FFT_SIZE / 2 - BURST_SAMPLES / 2;
            for (offset, &weight) in envelope.iter().enumerate() {
                let phase = 2.0 * PI * hz * offset as f64 / SAMPLE_RATE;
                signal[start + offset] += weight * phase.sin() as f32;
            }
        }
        signal
    }

    fn deltas(hashes: &[u32]) -> Vec<u32> {
        hashes.iter().map(|hash| hash & 0x3F).collect()
    }

    #[test]
    fn peaks_sixty_three_frames_apart_are_paired() {
        let print = fingerprint(&burst_signal(&[(5, KILOHERTZ), (68, 2.0 * KILOHERTZ)]));
        assert_eq!(deltas(&print.hashes), [63]);
        assert_eq!(print.times, [5]);
    }

    #[test]
    fn peaks_more_than_sixty_three_frames_apart_are_not_paired() {
        let print = fingerprint(&burst_signal(&[(5, KILOHERTZ), (69, 2.0 * KILOHERTZ)]));
        assert!(print.hashes.is_empty());
    }

    #[test]
    fn peaks_three_frames_apart_are_paired() {
        let print = fingerprint(&burst_signal(&[(5, KILOHERTZ), (8, 2.0 * KILOHERTZ)]));
        assert_eq!(deltas(&print.hashes), [3]);
    }

    #[test]
    fn each_peak_pairs_with_at_most_five_later_peaks() {
        let bursts: Vec<(usize, f64)> = (0..8).map(|index| (5 + index * 6, KILOHERTZ)).collect();
        let print = fingerprint(&burst_signal(&bursts));
        assert_eq!(print.hashes.len(), 5 + 5 + 5 + 4 + 3 + 2 + 1);
    }
}
