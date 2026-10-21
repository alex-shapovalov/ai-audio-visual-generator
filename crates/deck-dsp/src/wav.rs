use std::error::Error;
use std::fmt;

const HEADER_BYTES: usize = 44;
const CHUNK_OVERHEAD: u32 = 36;
const BYTES_PER_SAMPLE: u32 = 2;
const FORMAT_CHUNK_BYTES: u32 = 16;
const PCM_FORMAT: u16 = 1;
const MONO: u16 = 1;
const BLOCK_ALIGN: u16 = 2;
const BITS_PER_SAMPLE: u16 = 16;
const FULL_SCALE: f64 = 32767.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WavError {
    TooLong,
    SampleRateTooHigh,
}

impl fmt::Display for WavError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::TooLong => formatter.write_str("audio is too long for a WAV file"),
            Self::SampleRateTooHigh => {
                formatter.write_str("sample rate is too high for a WAV file")
            }
        }
    }
}

impl Error for WavError {}

pub fn encode_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, WavError> {
    let data_bytes = data_length(samples.len())?;
    let byte_rate = sample_rate
        .checked_mul(BYTES_PER_SAMPLE)
        .ok_or(WavError::SampleRateTooHigh)?;

    let mut bytes = Vec::with_capacity(HEADER_BYTES + data_bytes as usize);
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(CHUNK_OVERHEAD + data_bytes).to_le_bytes());
    bytes.extend_from_slice(b"WAVE");
    bytes.extend_from_slice(b"fmt ");
    bytes.extend_from_slice(&FORMAT_CHUNK_BYTES.to_le_bytes());
    bytes.extend_from_slice(&PCM_FORMAT.to_le_bytes());
    bytes.extend_from_slice(&MONO.to_le_bytes());
    bytes.extend_from_slice(&sample_rate.to_le_bytes());
    bytes.extend_from_slice(&byte_rate.to_le_bytes());
    bytes.extend_from_slice(&BLOCK_ALIGN.to_le_bytes());
    bytes.extend_from_slice(&BITS_PER_SAMPLE.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data_bytes.to_le_bytes());
    for &sample in samples {
        bytes.extend_from_slice(&quantize(sample).to_le_bytes());
    }
    Ok(bytes)
}

fn data_length(sample_count: usize) -> Result<u32, WavError> {
    sample_count
        .checked_mul(BYTES_PER_SAMPLE as usize)
        .and_then(|bytes| u32::try_from(bytes).ok())
        .filter(|&bytes| bytes <= u32::MAX - CHUNK_OVERHEAD)
        .ok_or(WavError::TooLong)
}

fn quantize(sample: f32) -> i16 {
    (f64::from(sample) * FULL_SCALE)
        .round()
        .clamp(-32768.0, FULL_SCALE) as i16
}
