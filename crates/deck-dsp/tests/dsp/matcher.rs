use deck_dsp::{
    DEMO_TRACKS, Downsampler, LibraryBuilder, LibraryError, LiveMatcher, MatchStatus, fingerprint,
    render_track,
};

use crate::common::{RATE, TRACKS, demo_library, excerpt, library_of, uniform_noise};

const CHUNK: usize = 2048;

fn push_in_chunks(matcher: &mut LiveMatcher, samples: &[f32]) -> Vec<MatchStatus> {
    samples
        .chunks_exact(CHUNK)
        .filter_map(|chunk| matcher.push(chunk))
        .collect()
}

fn live_matcher() -> LiveMatcher {
    let mut matcher = LiveMatcher::new();
    matcher.set_library(demo_library());
    matcher
}

#[test]
fn every_demo_track_is_identified_from_a_noisy_mid_track_excerpt() {
    let library = demo_library();
    for track in TRACKS.iter() {
        let heard = excerpt(&track.samples, 17.3, 6.0, 0.05, 0.6);
        let result = library.match_samples(&heard);
        let winner = result.cue.and_then(|cue| library.cue_id(cue));
        assert_eq!(winner, Some(track.id));
        assert!(result.score >= 8, "{}: score {}", track.id, result.score);
        assert!(
            f64::from(result.score) > 1.4 * f64::from(result.runner_up),
            "{}: {} vs runner-up {}",
            track.id,
            result.score,
            result.runner_up
        );
    }
}

#[test]
fn unrelated_noise_scores_below_the_match_threshold() {
    let result = demo_library().match_samples(&uniform_noise(6.0, 0.3, 99));
    assert!(result.score < 8, "score {}", result.score);
}

#[test]
fn an_empty_library_never_matches() {
    let result = LibraryBuilder::default()
        .build()
        .match_samples(&TRACKS[0].samples[..RATE as usize * 6]);
    assert_eq!((result.cue, result.score, result.runner_up), (None, 0, 0));
}

#[test]
fn live_matcher_confirms_only_the_playing_track() {
    let mut matcher = live_matcher();
    let heard = excerpt(&TRACKS[1].samples, 5.0, 12.0, 0.02, 0.6);
    let confirmed: Vec<MatchStatus> = push_in_chunks(&mut matcher, &heard)
        .into_iter()
        .filter(|status| status.confirmed)
        .collect();
    assert!(!confirmed.is_empty());
    assert!(
        confirmed
            .iter()
            .all(|status| status.candidate_id.as_deref() == Some(TRACKS[1].id))
    );
}

#[test]
fn two_identical_enrollments_are_ambiguous_and_never_confirm() {
    let mut matcher = LiveMatcher::new();
    matcher.set_library(library_of(&[
        ("original", &TRACKS[0].print),
        ("duplicate", &TRACKS[0].print),
    ]));
    let heard = excerpt(&TRACKS[0].samples, 8.0, 10.0, 0.0, 1.0);
    let statuses = push_in_chunks(&mut matcher, &heard);

    assert!(statuses.len() >= 4);
    for status in &statuses {
        assert!(status.score >= 8, "the track itself is heard");
        assert_eq!(status.score, status.runner_up);
        assert_eq!(status.candidate_id, None);
        assert!(!status.confirmed);
    }
}

#[test]
fn noise_alone_never_produces_a_candidate() {
    let mut matcher = live_matcher();
    let statuses = push_in_chunks(&mut matcher, &uniform_noise(10.0, 0.3, 99));
    assert!(statuses.len() >= 4);
    assert!(
        statuses
            .iter()
            .all(|status| status.candidate_id.is_none() && !status.confirmed)
    );
}

#[test]
fn live_matcher_needs_two_consecutive_windows_before_confirming() {
    let mut matcher = live_matcher();
    let heard = excerpt(&TRACKS[0].samples, 8.0, 8.0, 0.0, 1.0);
    let statuses = push_in_chunks(&mut matcher, &heard);

    assert!(statuses.len() >= 2);
    assert_eq!(statuses[0].candidate_id.as_deref(), Some(TRACKS[0].id));
    assert!(!statuses[0].confirmed);
    assert!(statuses[1].confirmed);
    assert!((3.0..3.3).contains(&statuses[0].listened_seconds));
    assert!((4.0..4.4).contains(&statuses[1].listened_seconds));
}

#[test]
fn live_matcher_stays_silent_until_three_seconds_are_buffered() {
    let mut matcher = live_matcher();
    let heard = excerpt(&TRACKS[0].samples, 8.0, 2.8, 0.0, 1.0);
    assert!(push_in_chunks(&mut matcher, &heard).is_empty());
}

#[test]
fn reset_forgets_the_previous_source() {
    let mut matcher = live_matcher();
    let first = excerpt(&TRACKS[0].samples, 8.0, 8.0, 0.0, 1.0);
    assert!(
        push_in_chunks(&mut matcher, &first)
            .iter()
            .any(|status| status.confirmed)
    );

    matcher.reset();
    let next = excerpt(&TRACKS[2].samples, 8.0, 2.8, 0.0, 1.0);
    assert!(push_in_chunks(&mut matcher, &next).is_empty());
}

#[test]
fn live_matcher_reports_no_candidate_for_an_empty_library() {
    let mut matcher = LiveMatcher::new();
    let heard = excerpt(&TRACKS[0].samples, 8.0, 5.0, 0.0, 1.0);
    let statuses = push_in_chunks(&mut matcher, &heard);
    assert!(!statuses.is_empty());
    assert!(
        statuses
            .iter()
            .all(|status| status.candidate_id.is_none() && !status.confirmed)
    );
}

#[test]
fn replacing_the_library_restarts_confirmation() {
    let mut matcher = live_matcher();
    let heard = excerpt(&TRACKS[0].samples, 8.0, 8.0, 0.0, 1.0);
    let (first_half, second_half) = heard.split_at(heard.len() / 2);
    push_in_chunks(&mut matcher, first_half);

    matcher.set_library(demo_library());
    let statuses = push_in_chunks(&mut matcher, second_half);
    let first_status = statuses.first().expect("a window completes");
    assert!(!first_status.confirmed);
}

#[test]
fn live_capture_at_44100_hz_matches_a_track_enrolled_from_a_decoded_file() {
    const CAPTURE_RATE: u32 = 44_100;
    let trance = &DEMO_TRACKS[2];
    let captured = render_track(&trance.spec, CAPTURE_RATE).expect("demo spec is valid");

    let enrolled_samples = Downsampler::new(f64::from(CAPTURE_RATE)).push(&captured);
    let enrolled = fingerprint(&enrolled_samples);
    let others: Vec<_> = TRACKS
        .iter()
        .filter(|track| track.id != trance.file)
        .map(|track| (track.id, &track.print))
        .collect();
    let mut entries = vec![("enrolled", &enrolled)];
    entries.extend(others);
    let mut matcher = LiveMatcher::new();
    matcher.set_library(library_of(&entries));

    let start = (9.1 * f64::from(CAPTURE_RATE)) as usize;
    let half_level: Vec<f32> = captured[start..start + 14 * CAPTURE_RATE as usize]
        .iter()
        .map(|sample| sample * 0.5)
        .collect();
    let mut capture_path = Downsampler::new(f64::from(CAPTURE_RATE));
    let heard: Vec<f32> = half_level
        .chunks(CHUNK)
        .flat_map(|chunk| capture_path.push(chunk))
        .collect();

    let confirmed: Vec<MatchStatus> = push_in_chunks(&mut matcher, &heard)
        .into_iter()
        .filter(|status| status.confirmed)
        .collect();
    assert!(!confirmed.is_empty());
    assert!(
        confirmed
            .iter()
            .all(|status| status.candidate_id.as_deref() == Some("enrolled"))
    );
}

#[test]
fn a_cue_with_mismatched_hash_and_time_counts_is_rejected() {
    let mut builder = LibraryBuilder::default();
    let error = builder
        .add_cue("broken", &[1, 2, 3], &[1, 2])
        .expect_err("lengths differ");
    assert_eq!(
        error,
        LibraryError::LengthMismatch {
            id: "broken".to_owned(),
            hashes: 3,
            times: 2
        }
    );
    assert_eq!(builder.build().cue_count(), 0);
}

#[test]
fn matching_stays_decisive_at_any_sub_frame_phase_between_live_audio_and_the_enrolled_file() {
    let library = demo_library();
    for track in TRACKS.iter() {
        for step in -3..=3 {
            let shift_seconds = f64::from(step) * 64.0 / f64::from(RATE);
            let heard = excerpt(&track.samples, 17.3 + shift_seconds, 6.0, 0.05, 0.6);
            let result = library.match_samples(&heard);
            let label = format!("{} shifted by {} samples", track.id, step * 64);
            assert_eq!(
                result.cue.and_then(|cue| library.cue_id(cue)),
                Some(track.id),
                "{label}"
            );
            assert!(result.score >= 8, "{label}: score {}", result.score);
            assert!(
                f64::from(result.score) > 1.4 * f64::from(result.runner_up),
                "{label}: {} vs runner-up {}",
                result.score,
                result.runner_up
            );
        }
    }
}
