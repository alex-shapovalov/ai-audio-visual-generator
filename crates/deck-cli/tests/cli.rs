use std::path::Path;
use std::process::{Command, Output};

use hound::WavReader;
use tempfile::tempdir;

const DEMO_FILES: [&str; 3] = [
    "demo-tech-house-126.wav",
    "demo-dubstep-140.wav",
    "demo-trance-136.wav",
];

fn deck_cli(args: &[&str], extra: &[&Path]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_deck-cli"))
        .args(args)
        .args(extra)
        .output()
        .expect("deck-cli runs")
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

#[test]
fn demo_tracks_writes_three_mono_16_bit_wavs_of_48_seconds() {
    let directory = tempdir().expect("temp dir");
    let output = deck_cli(&["demo-tracks", "--out"], &[directory.path()]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );

    for file in DEMO_FILES {
        let reader = WavReader::open(directory.path().join(file)).expect("a readable WAV");
        let spec = reader.spec();
        assert_eq!(
            (spec.channels, spec.sample_rate, spec.bits_per_sample),
            (1, 44_100, 16),
            "{file}"
        );
        assert_eq!(reader.duration(), 48 * 44_100, "{file}");
        assert!(stdout(&output).contains(file), "{file} was not reported");
    }
}

#[test]
fn demo_tracks_creates_the_output_directory() {
    let directory = tempdir().expect("temp dir");
    let nested = directory.path().join("a").join("b");
    let output = deck_cli(&["demo-tracks", "--out"], &[&nested]);
    assert!(output.status.success());
    assert!(nested.join(DEMO_FILES[0]).is_file());
}

#[test]
fn fingerprint_reports_the_hash_count_and_stats_of_a_generated_track() {
    let directory = tempdir().expect("temp dir");
    deck_cli(&["demo-tracks", "--out"], &[directory.path()]);

    let wav = directory.path().join(DEMO_FILES[1]);
    let output = deck_cli(&["fingerprint"], &[&wav]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );

    let report = stdout(&output);
    assert!(report.contains("duration:    48.00 s"), "{report}");
    let hashes: usize = report
        .lines()
        .find_map(|line| line.strip_prefix("hashes:"))
        .and_then(|value| value.trim().parse().ok())
        .expect("a hashes line with a number");
    assert!(hashes > 1000, "{report}");
}

#[test]
fn fingerprint_fails_cleanly_for_a_missing_file() {
    let directory = tempdir().expect("temp dir");
    let output = deck_cli(&["fingerprint"], &[&directory.path().join("missing.wav")]);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).starts_with("error:"));
}

#[test]
fn fingerprint_fails_cleanly_for_a_file_that_is_not_a_wav() {
    let directory = tempdir().expect("temp dir");
    let bogus = directory.path().join("bogus.wav");
    std::fs::write(&bogus, b"definitely not audio").expect("write");
    let output = deck_cli(&["fingerprint"], &[&bogus]);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).starts_with("error:"));
}
