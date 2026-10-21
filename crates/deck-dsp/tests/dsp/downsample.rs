use deck_dsp::{Downsampler, MATCH_RATE};

const CHUNK_SIZES: [usize; 5] = [1, 7, 2048, 4410, 5000];

fn test_signal(length: usize) -> Vec<f32> {
    (0..length)
        .map(|index| (index as f32 * 0.013).sin() * 0.5 + (index as f32 * 0.31).cos() * 0.25)
        .collect()
}

fn in_chunks(rate: f64, signal: &[f32], chunk: usize) -> Vec<f32> {
    let mut downsampler = Downsampler::new(rate);
    signal
        .chunks(chunk)
        .flat_map(|part| downsampler.push(part))
        .collect()
}

#[test]
fn live_chunks_give_the_same_result_as_one_big_call() {
    for rate in [44_100.0, 48_000.0, 96_000.0] {
        let signal = test_signal(rate as usize / 2);
        let whole = in_chunks(rate, &signal, signal.len());
        for chunk in CHUNK_SIZES {
            assert_eq!(
                in_chunks(rate, &signal, chunk),
                whole,
                "{rate} Hz, chunk {chunk}"
            );
        }
    }
}

#[test]
fn output_length_follows_the_rate_ratio() {
    for rate in [44_100.0, 48_000.0] {
        let seconds = 3.0;
        let signal = test_signal((rate * seconds) as usize);
        let expected = seconds * f64::from(MATCH_RATE);
        let produced = in_chunks(rate, &signal, 2048).len() as f64;
        assert!(
            (produced - expected).abs() <= 1.0,
            "{rate} Hz: {produced} vs {expected}"
        );
    }
}

#[test]
fn a_constant_signal_stays_constant() {
    let output = in_chunks(48_000.0, &vec![0.25; 48_000], 2048);
    assert!(!output.is_empty());
    assert!(output.iter().all(|&sample| (sample - 0.25).abs() < 1e-6));
}

#[test]
fn averaging_attenuates_frequencies_above_the_new_nyquist() {
    let rate = 44_100.0_f64;
    let tone = |hz: f64| -> Vec<f32> {
        (0..rate as usize)
            .map(|index| (2.0 * std::f64::consts::PI * hz * index as f64 / rate).sin() as f32)
            .collect()
    };
    let peak = |samples: &[f32]| {
        samples
            .iter()
            .skip(100)
            .fold(0.0_f32, |max, &sample| max.max(sample.abs()))
    };

    let low = peak(&in_chunks(rate, &tone(500.0), 2048));
    let high = peak(&in_chunks(rate, &tone(10_000.0), 2048));
    assert!(low > 0.9, "low tone peak {low}");
    assert!(high < low / 2.0, "aliased tone peak {high}");
}
