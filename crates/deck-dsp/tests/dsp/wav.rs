use deck_dsp::{WavError, encode_wav};

fn u16_at(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn u32_at(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn i16_samples(bytes: &[u8]) -> Vec<i16> {
    bytes[44..]
        .chunks_exact(2)
        .map(|pair| i16::from_le_bytes([pair[0], pair[1]]))
        .collect()
}

#[test]
fn writes_a_standard_mono_16_bit_pcm_header() {
    let bytes = encode_wav(&[0.0; 100], 44_100).expect("encodes");
    assert_eq!(&bytes[0..4], b"RIFF");
    assert_eq!(u32_at(&bytes, 4), 36 + 200);
    assert_eq!(&bytes[8..12], b"WAVE");
    assert_eq!(&bytes[12..16], b"fmt ");
    assert_eq!(u32_at(&bytes, 16), 16);
    assert_eq!(u16_at(&bytes, 20), 1);
    assert_eq!(u16_at(&bytes, 22), 1);
    assert_eq!(u32_at(&bytes, 24), 44_100);
    assert_eq!(u32_at(&bytes, 28), 88_200);
    assert_eq!(u16_at(&bytes, 32), 2);
    assert_eq!(u16_at(&bytes, 34), 16);
    assert_eq!(&bytes[36..40], b"data");
    assert_eq!(u32_at(&bytes, 40), 200);
    assert_eq!(bytes.len(), 44 + 200);
}

#[test]
fn quantizes_samples_to_signed_16_bit_and_clips_overload() {
    let bytes = encode_wav(&[0.0, 1.0, -1.0, 0.25, -0.25, 2.0, -2.0], 8_000).expect("encodes");
    assert_eq!(
        i16_samples(&bytes),
        [0, 32767, -32767, 8192, -8192, 32767, -32768]
    );
}

#[test]
fn an_empty_buffer_still_produces_a_valid_header() {
    let bytes = encode_wav(&[], 8_000).expect("encodes");
    assert_eq!(bytes.len(), 44);
    assert_eq!(u32_at(&bytes, 40), 0);
}

#[test]
fn rejects_a_sample_rate_whose_byte_rate_overflows() {
    assert_eq!(
        encode_wav(&[0.0], u32::MAX),
        Err(WavError::SampleRateTooHigh)
    );
}
