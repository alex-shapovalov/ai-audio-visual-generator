mod audio;

use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use deck_dsp::{DEMO_TRACKS, Downsampler, encode_wav, fingerprint, render_track};

const DEMO_SAMPLE_RATE: u32 = 44_100;

#[derive(Parser)]
#[command(
    name = "deck-cli",
    about = "Offline audio tools for the Afterimage deck"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    #[command(about = "Write the three deterministic demo tracks as WAV files")]
    DemoTracks {
        #[arg(long, default_value = "demo-audio")]
        out: PathBuf,
    },
    #[command(about = "Print the fingerprint size and stats of a WAV file")]
    Fingerprint { wav: PathBuf },
}

fn write_demo_tracks(out: &Path) -> Result<(), Box<dyn Error>> {
    fs::create_dir_all(out)?;
    for track in &DEMO_TRACKS {
        let samples = render_track(&track.spec, DEMO_SAMPLE_RATE)?;
        let path = out.join(track.file);
        fs::write(&path, encode_wav(&samples, DEMO_SAMPLE_RATE)?)?;
        println!("wrote {}", path.display());
    }
    Ok(())
}

fn print_fingerprint(wav: &Path) -> Result<(), Box<dyn Error>> {
    let decoded = audio::read_mono(wav)?;
    let samples = Downsampler::new(f64::from(decoded.sample_rate)).push(&decoded.samples);
    let print = fingerprint(&samples);
    println!("file:        {}", wav.display());
    println!("duration:    {:.2} s", print.stats.duration);
    println!("hashes:      {}", print.hashes.len());
    println!("bass share:  {:.4}", print.stats.bass);
    println!("brightness:  {:.4}", print.stats.brightness);
    Ok(())
}

fn run(cli: Cli) -> Result<(), Box<dyn Error>> {
    match cli.command {
        Command::DemoTracks { out } => write_demo_tracks(&out),
        Command::Fingerprint { wav } => print_fingerprint(&wav),
    }
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}
