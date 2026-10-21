pub const MATCH_RATE: u32 = 11025;

pub struct Downsampler {
    ratio: f64,
    position: f64,
    sum: f64,
    count: u32,
}

impl Downsampler {
    pub fn new(input_rate: f64) -> Self {
        Self {
            ratio: input_rate / f64::from(MATCH_RATE),
            position: 0.0,
            sum: 0.0,
            count: 0,
        }
    }

    pub fn push(&mut self, input: &[f32]) -> Vec<f32> {
        let capacity = (input.len() as f64 / self.ratio).ceil() as usize + 1;
        let mut output = Vec::with_capacity(capacity);
        for &sample in input {
            self.sum += f64::from(sample);
            self.count += 1;
            self.position += 1.0;
            if self.position >= self.ratio {
                output.push((self.sum / f64::from(self.count)) as f32);
                self.sum = 0.0;
                self.count = 0;
                self.position -= self.ratio;
            }
        }
        output
    }
}
