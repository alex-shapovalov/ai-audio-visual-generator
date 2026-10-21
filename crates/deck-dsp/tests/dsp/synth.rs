use deck_dsp::{DEMO_TRACKS, SpecError, TrackSpec, render_track};

const SCALE: [i32; 5] = [0, 3, 5, 7, 10];

fn spec(overrides: impl FnOnce(&mut TrackSpec<'static>)) -> TrackSpec<'static> {
    let mut spec = TrackSpec {
        seed: 3,
        bpm: 120.0,
        seconds: 2.0,
        root_hz: 110.0,
        scale: &SCALE,
    };
    overrides(&mut spec);
    spec
}

#[test]
fn rendering_is_deterministic_for_a_seed_and_differs_between_seeds() {
    let first = render_track(&spec(|_| {}), 11_025).expect("valid spec");
    let again = render_track(&spec(|_| {}), 11_025).expect("valid spec");
    let other = render_track(&spec(|spec| spec.seed = 4), 11_025).expect("valid spec");
    assert_eq!(first, again);
    assert_ne!(first, other);
}

#[test]
fn the_length_follows_duration_and_sample_rate() {
    let samples = render_track(&spec(|_| {}), 8_000).expect("valid spec");
    assert_eq!(samples.len(), 16_000);
}

#[test]
fn demo_tracks_are_audible_and_never_exceed_full_scale() {
    for demo in &DEMO_TRACKS {
        let samples = render_track(&demo.spec, 11_025).expect("demo specs are valid");
        let peak = samples
            .iter()
            .fold(0.0_f32, |max, &sample| max.max(sample.abs()));
        assert!(peak > 0.5 && peak <= 1.0, "{}: peak {peak}", demo.file);
    }
}

#[test]
fn invalid_specs_are_rejected() {
    let cases = [
        (spec(|spec| spec.bpm = 0.0), 11_025, SpecError::InvalidTempo),
        (
            spec(|spec| spec.bpm = f64::NAN),
            11_025,
            SpecError::InvalidTempo,
        ),
        (
            spec(|spec| spec.seconds = -1.0),
            11_025,
            SpecError::InvalidDuration,
        ),
        (spec(|_| {}), 0, SpecError::InvalidSampleRate),
        (
            spec(|spec| spec.scale = &[0, 3]),
            11_025,
            SpecError::ScaleTooShort,
        ),
    ];
    for (case, rate, expected) in cases {
        assert_eq!(render_track(&case, rate), Err(expected));
    }
}
