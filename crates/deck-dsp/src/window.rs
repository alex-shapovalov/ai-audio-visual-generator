use std::f64::consts::PI;

pub fn hann(size: usize) -> Vec<f32> {
    let span = size.saturating_sub(1).max(1) as f64;
    (0..size)
        .map(|index| (0.5 - 0.5 * (2.0 * PI * index as f64 / span).cos()) as f32)
        .collect()
}
