use std::f64::consts::PI;

use deck_dsp::fft::Fft;
use deck_dsp::window::hann;

const SIZE: usize = 1024;

fn spectrum_of(input: &[f32]) -> Vec<f32> {
    let mut fft = Fft::new(input.len());
    let mut out = vec![0.0; input.len() / 2];
    fft.magnitudes(input, &mut out);
    out
}

#[test]
fn a_sine_on_a_bin_center_peaks_at_half_the_size_in_that_bin_only() {
    for bin in [1, 17, 100, 511] {
        let input: Vec<f32> = (0..SIZE)
            .map(|index| (2.0 * PI * bin as f64 * index as f64 / SIZE as f64).sin() as f32)
            .collect();
        let spectrum = spectrum_of(&input);
        let expected = SIZE as f32 / 2.0;
        assert!(
            (spectrum[bin] - expected).abs() < expected * 1e-4,
            "bin {bin}: {}",
            spectrum[bin]
        );
        for (other, &magnitude) in spectrum.iter().enumerate() {
            if other != bin {
                assert!(
                    magnitude < 1e-2,
                    "bin {bin} leaked {magnitude} into {other}"
                );
            }
        }
    }
}

#[test]
fn an_impulse_has_a_flat_spectrum() {
    let mut input = vec![0.0; SIZE];
    input[0] = 1.0;
    assert!(
        spectrum_of(&input)
            .iter()
            .all(|&magnitude| (magnitude - 1.0).abs() < 1e-6)
    );
}

#[test]
fn a_delayed_impulse_keeps_the_same_magnitudes() {
    let mut input = vec![0.0; SIZE];
    input[37] = 1.0;
    assert!(
        spectrum_of(&input)
            .iter()
            .all(|&magnitude| (magnitude - 1.0).abs() < 1e-6)
    );
}

#[test]
fn silence_has_an_empty_spectrum() {
    assert!(
        spectrum_of(&vec![0.0; SIZE])
            .iter()
            .all(|&magnitude| magnitude == 0.0)
    );
}

#[test]
fn the_transform_is_reusable_without_state_leaking_between_calls() {
    let mut fft = Fft::new(SIZE);
    let mut loud = vec![0.0; SIZE];
    loud[5] = 1.0;
    let mut first = vec![0.0; SIZE / 2];
    fft.magnitudes(&loud, &mut first);

    let mut silent_out = vec![1.0; SIZE / 2];
    fft.magnitudes(&vec![0.0; SIZE], &mut silent_out);
    assert!(silent_out.iter().all(|&magnitude| magnitude == 0.0));
}

#[test]
#[should_panic(expected = "power of two")]
fn a_size_that_is_not_a_power_of_two_is_rejected() {
    Fft::new(1000);
}

#[test]
fn the_hann_window_is_symmetric_and_tapers_to_zero() {
    let window = hann(SIZE);
    assert_eq!(window.len(), SIZE);
    assert!(window[0].abs() < 1e-7);
    assert!(window[SIZE - 1].abs() < 1e-6);
    assert!(window[SIZE / 2] > 0.999);
    for index in 0..SIZE / 2 {
        assert!(
            (window[index] - window[SIZE - 1 - index]).abs() < 1e-6,
            "index {index}"
        );
    }
}
