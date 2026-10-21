use deck_dsp::{DEMO_TRACKS, Downsampler, Section, render_track};

use crate::common::{TRACKS, demo_library, excerpt, gaps, simulate};

const TS_HASH_COUNTS: [usize; 3] = [5433, 5760, 5340];
const TS_BASS_SHARE: [f64; 3] = [0.6044682854696464, 0.6015913628499113, 0.5971352038492358];
const TS_BRIGHTNESS: [f64; 3] = [0.17005762001132635, 0.1419809808530792, 0.18207357227900778];

const TS_SAMPLES_11025: [[(usize, f32); 5]; 3] = [
    [
        (1, 0.114_988_88),
        (100, 0.105_367_83),
        (5000, 0.059_554_57),
        (100_000, 0.230_541_36),
        (529_199, -0.027_645_39),
    ],
    [
        (1, 0.097_390_43),
        (100, 0.007_219_397),
        (5000, -0.450_985_97),
        (100_000, 0.419_969_1),
        (529_199, -0.044_144_79),
    ],
    [
        (1, 0.106_609_95),
        (100, 0.351_335_73),
        (5000, 0.554_323_8),
        (100_000, 0.114_385_86),
        (529_199, -0.009_617_305),
    ],
];

const TS_TRANCE_44100_LENGTH: usize = 2_116_800;
const TS_TRANCE_44100: [(usize, f32); 5] = [
    (1, 0.026_771_864),
    (1000, 0.339_504_75),
    (99_999, -0.211_339_17),
    (1_000_000, -0.083_196_714),
    (2_116_799, -0.002_183_545_8),
];

const TS_DOWNSAMPLE_48000_LENGTH: usize = 22_049;
const TS_DOWNSAMPLE_48000_FIRST: [f32; 6] = [
    0.052_982_06,
    0.170_219_88,
    0.281_085_13,
    0.382_718_62,
    0.462_726_15,
    0.539_548_93,
];

const TS_SIMULATOR_BPM: f64 = 128.571_428_571_447_29;
const TS_SIMULATOR_HITS: usize = 95;
const TS_SIMULATOR_FRAMES: [(Section, usize); 4] = [
    (Section::Groove, 673),
    (Section::Breakdown, 176),
    (Section::Build, 645),
    (Section::Drop, 2107),
];

struct RobustnessCell {
    noise: f64,
    seconds: f64,
    gain: f64,
    reference_scores: [u32; 3],
}

const TS_ROBUSTNESS: [RobustnessCell; 6] = [
    RobustnessCell {
        noise: 0.05,
        seconds: 3.0,
        gain: 1.0,
        reference_scores: [117, 158, 134],
    },
    RobustnessCell {
        noise: 0.05,
        seconds: 6.0,
        gain: 1.0,
        reference_scores: [295, 294, 300],
    },
    RobustnessCell {
        noise: 0.15,
        seconds: 3.0,
        gain: 0.3,
        reference_scores: [32, 48, 38],
    },
    RobustnessCell {
        noise: 0.30,
        seconds: 3.0,
        gain: 1.0,
        reference_scores: [84, 114, 96],
    },
    RobustnessCell {
        noise: 0.30,
        seconds: 3.0,
        gain: 0.3,
        reference_scores: [27, 25, 15],
    },
    RobustnessCell {
        noise: 0.30,
        seconds: 6.0,
        gain: 0.3,
        reference_scores: [49, 43, 22],
    },
];

fn assert_close(actual: f64, expected: f64, relative: f64, label: &str) {
    let allowed = expected.abs() * relative;
    assert!(
        (actual - expected).abs() <= allowed,
        "{label}: {actual} vs reference {expected}"
    );
}

#[test]
fn fingerprints_match_the_typescript_reference_in_size_and_stats() {
    for (index, track) in TRACKS.iter().enumerate() {
        let label = track.id;
        assert_close(
            track.print.hashes.len() as f64,
            TS_HASH_COUNTS[index] as f64,
            0.005,
            label,
        );
        assert_close(track.print.stats.bass, TS_BASS_SHARE[index], 1e-4, label);
        assert_close(
            track.print.stats.brightness,
            TS_BRIGHTNESS[index],
            1e-4,
            label,
        );
    }
}

#[test]
fn synthesized_samples_match_the_typescript_reference() {
    for (track, expected) in TRACKS.iter().zip(TS_SAMPLES_11025) {
        for (index, value) in expected {
            let sample = track.samples[index];
            assert!(
                (sample - value).abs() < 1e-6,
                "{} [{index}]: {sample} vs {value}",
                track.id
            );
        }
    }
}

#[test]
fn synthesis_at_44100_hz_matches_the_typescript_reference() {
    let samples = render_track(&DEMO_TRACKS[2].spec, 44_100).expect("demo spec is valid");
    assert_eq!(samples.len(), TS_TRANCE_44100_LENGTH);
    for (index, value) in TS_TRANCE_44100 {
        assert!(
            (samples[index] - value).abs() < 1e-6,
            "[{index}]: {} vs {value}",
            samples[index]
        );
    }
}

#[test]
fn downsampling_from_48_khz_matches_the_typescript_reference() {
    let samples = render_track(&DEMO_TRACKS[0].spec, 48_000).expect("demo spec is valid");
    let output = Downsampler::new(48_000.0).push(&samples[..96_000]);
    assert_eq!(output.len(), TS_DOWNSAMPLE_48000_LENGTH);
    for (index, value) in TS_DOWNSAMPLE_48000_FIRST.into_iter().enumerate() {
        assert!(
            (output[index] - value).abs() < 1e-6,
            "[{index}]: {} vs {value}",
            output[index]
        );
    }
}

#[test]
fn the_simulator_pipeline_matches_the_typescript_reference() {
    let run = simulate();
    assert_close(run.bpm, TS_SIMULATOR_BPM, 1e-3, "bpm");
    assert_eq!(run.hit_times.len(), TS_SIMULATOR_HITS);
    assert!(gaps(&run.hit_times).into_iter().all(|gap| gap > 460.0));
    for (section, expected) in TS_SIMULATOR_FRAMES {
        let frames = run.section_frames.get(&section).copied().unwrap_or(0);
        assert!(
            frames.abs_diff(expected) <= 2,
            "{section:?}: {frames} vs {expected}"
        );
    }
}

#[test]
fn matching_under_noise_and_attenuation_is_not_worse_than_the_typescript_reference() {
    let library = demo_library();
    for cell in &TS_ROBUSTNESS {
        for (track, reference_score) in TRACKS.iter().zip(cell.reference_scores) {
            let heard = excerpt(&track.samples, 20.37, cell.seconds, cell.noise, cell.gain);
            let result = library.match_samples(&heard);
            let label = format!(
                "{} noise {} secs {} gain {}",
                track.id, cell.noise, cell.seconds, cell.gain
            );
            let winner = result.cue.and_then(|cue| library.cue_id(cue));
            assert_eq!(winner, Some(track.id), "{label}");
            let floor = f64::from(reference_score) * 0.85;
            assert!(
                f64::from(result.score) >= floor,
                "{label}: {} vs reference {reference_score}",
                result.score
            );
        }
    }
}
