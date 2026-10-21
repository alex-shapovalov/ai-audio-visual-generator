use std::error::Error;
use std::path::Path;

use hound::{SampleFormat, WavReader};

pub struct DecodedAudio {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

pub fn read_mono(path: &Path) -> Result<DecodedAudio, Box<dyn Error>> {
    let mut reader = WavReader::open(path)?;
    let spec = reader.spec();
    let channels = usize::from(spec.channels);
    if channels == 0 {
        return Err("WAV file declares zero channels".into());
    }
    let interleaved = read_interleaved(&mut reader)?;
    let samples = interleaved
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();
    Ok(DecodedAudio {
        samples,
        sample_rate: spec.sample_rate,
    })
}

fn read_interleaved<R: std::io::Read>(
    reader: &mut WavReader<R>,
) -> Result<Vec<f32>, Box<dyn Error>> {
    let spec = reader.spec();
    match spec.sample_format {
        SampleFormat::Float => Ok(reader.samples::<f32>().collect::<Result<_, _>>()?),
        SampleFormat::Int => {
            let full_scale = 2f32.powi(i32::from(spec.bits_per_sample) - 1);
            reader
                .samples::<i32>()
                .map(|sample| sample.map(|value| value as f32 / full_scale))
                .collect::<Result<_, _>>()
                .map_err(Into::into)
        }
    }
}
