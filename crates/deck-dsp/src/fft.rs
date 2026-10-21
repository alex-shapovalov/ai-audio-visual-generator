use std::f64::consts::PI;

pub struct Fft {
    size: usize,
    cos: Vec<f64>,
    sin: Vec<f64>,
    reverse: Vec<usize>,
    re: Vec<f64>,
    im: Vec<f64>,
}

impl Fft {
    pub fn new(size: usize) -> Self {
        assert!(
            size >= 2 && size.is_power_of_two(),
            "FFT size must be a power of two"
        );
        let angle = |index: usize| 2.0 * PI * index as f64 / size as f64;
        let bits = size.trailing_zeros();
        Self {
            size,
            cos: (0..size / 2).map(|index| angle(index).cos()).collect(),
            sin: (0..size / 2).map(|index| angle(index).sin()).collect(),
            reverse: (0..size)
                .map(|index| index.reverse_bits() >> (usize::BITS - bits))
                .collect(),
            re: vec![0.0; size],
            im: vec![0.0; size],
        }
    }

    pub fn size(&self) -> usize {
        self.size
    }

    pub fn magnitudes(&mut self, input: &[f32], out: &mut [f32]) {
        assert_eq!(
            input.len(),
            self.size,
            "input length must equal the FFT size"
        );
        let bins = self.size / 2;
        assert!(out.len() >= bins, "output must hold size / 2 bins");
        self.load(input);
        self.butterflies();
        for (bin, slot) in out.iter_mut().take(bins).enumerate() {
            *slot = self.re[bin].hypot(self.im[bin]) as f32;
        }
    }

    fn load(&mut self, input: &[f32]) {
        for (&target, &sample) in self.reverse.iter().zip(input) {
            self.re[target] = f64::from(sample);
            self.im[target] = 0.0;
        }
    }

    fn butterflies(&mut self) {
        let size = self.size;
        let mut length = 2;
        while length <= size {
            let half = length / 2;
            let step = size / length;
            for start in (0..size).step_by(length) {
                for offset in 0..half {
                    let a = start + offset;
                    let b = a + half;
                    let cos = self.cos[offset * step];
                    let sin = self.sin[offset * step];
                    let tr = self.re[b] * cos + self.im[b] * sin;
                    let ti = self.im[b] * cos - self.re[b] * sin;
                    self.re[b] = self.re[a] - tr;
                    self.im[b] = self.im[a] - ti;
                    self.re[a] += tr;
                    self.im[a] += ti;
                }
            }
            length <<= 1;
        }
    }
}
