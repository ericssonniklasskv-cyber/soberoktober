"""Render an original 24-beat brass-and-percussion victory fanfare.
Requires NumPy; writes a stereo PCM WAV, then use afconvert for the web M4A.
No third-party recordings or compositions. The final mix peaks at -0.54 dBFS.
"""
import sys
import wave
import numpy as np

RATE = 44100
BEAT = 60 / 138
DURATION = 24 * BEAT + 3
rng = np.random.default_rng(3102026)
mix = np.zeros((int(RATE * DURATION), 2))

def add(signal, at, gain=1, pan=0):
    start = int(at * RATE)
    end = min(len(mix), start + len(signal))
    signal = signal[:end - start] * gain
    mix[start:end, 0] += signal * np.sqrt((1 - pan) / 2)
    mix[start:end, 1] += signal * np.sqrt((1 + pan) / 2)

def horn(midi, beats, gain=.15, pan=0, at=0, mellow=False):
    duration = beats * BEAT
    t = np.arange(int(RATE * duration)) / RATE
    freq = 440 * 2 ** ((midi - 69) / 12)
    env = np.minimum(1, t / .018) * np.minimum(1, (duration - t) / .09)
    env *= .7 + .3 * np.exp(-t / .12)
    signal = np.zeros(len(t))
    for detune in [-.0018, .0014]:
        phase = 2 * np.pi * freq * ((1 + detune) * t + .00035 * np.sin(2 * np.pi * 5.1 * t))
        for harmonic in range(1, 13 if not mellow else 7):
            signal += np.sin(harmonic * phase) / harmonic ** (1.08 if not mellow else 1.7)
    signal = np.tanh(signal * .6) * env
    add(signal, at * BEAT, gain, pan)

def drum(at, gain=.25, snare=False):
    t = np.arange(int(RATE * .45)) / RATE
    if snare:
        noise = rng.normal(0, 1, len(t))
        signal = (noise - np.roll(noise, 2)) * np.exp(-t * 24) * .3 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 35) * .3
    else:
        phase = 2 * np.pi * (55 * t + 25 / 18 * (1 - np.exp(-18 * t)))
        signal = np.sin(phase) * np.exp(-t * 10)
    add(signal, at * BEAT, gain)

def cymbal(at, gain=.12):
    t = np.arange(int(RATE * 2.1)) / RATE
    noise = rng.normal(0, 1, len(t))
    metallic = sum(np.sin(2 * np.pi * f * t) for f in [4211, 5639, 7283, 8971]) * .08
    signal = ((noise - np.roll(noise, 1)) * .12 + metallic) * np.exp(-t * 2.8) * np.minimum(1, t / .002)
    add(signal, at * BEAT, gain)

lead = [(0,67,.35),(.5,67,.35),(1,72,.8),(2,76,.8),(3,79,.8),
        (4,79,.35),(4.5,79,.35),(5,81,.8),(6,79,.8),(7,76,.8),
        (8,77,.8),(9,76,.8),(10,74,.8),(11,71,.8),
        (12,72,.35),(12.5,76,.35),(13,79,.8),(14,84,1.7),
        (16,81,.8),(17,79,.8),(18,77,.8),(19,79,.8),(20,84,3.8)]
for at, note, length in lead:
    horn(note, length, .34, -.12, at)
    horn(note - 12, length, .15, .22, at, True)
chords = [(0,[48,52,55]),(4,[53,57,60]),(8,[43,50,55]),(12,[48,52,55]),(16,[53,57,60]),(18,[43,50,59]),(20,[48,52,55,60,64,67])]
for i, (at, chord) in enumerate(chords):
    length = (chords[i+1][0] - at if i+1 < len(chords) else 4) - .12
    for n, note in enumerate(chord): horn(note, length, .13, -.45 + n / len(chord) * .9, at, True)
for beat in range(24):
    drum(beat, .31 if beat % 2 == 0 else .22)
    if beat % 2: drum(beat, .23, True)
for beat in np.arange(18,20,.25): drum(beat, .11 + (beat - 18) * .06, True)
for beat in [0,4,12,20]: cymbal(beat, .3)
# Room reflections and a long, celebratory final chord tail.
dry = mix.copy()
for delay, gain in [(.045,.16),(.083,.13),(.127,.10),(.219,.08),(.347,.07),(.503,.055),(.711,.04),(.947,.03)]:
    shift = int(delay * RATE)
    mix[shift:] += dry[:-shift, ::-1] * gain
mix = np.tanh(mix * 1.05)
mix *= .94 / np.max(np.abs(mix))
fade = int(RATE * .6)
mix[-fade:] *= np.linspace(1,0,fade)[:,None]
with wave.open(sys.argv[1], 'wb') as output:
    output.setnchannels(2); output.setsampwidth(2); output.setframerate(RATE)
    output.writeframes((mix * 32767).astype('<i2').tobytes())
print(f'Original fanfare: {DURATION:.2f}s, stereo {RATE} Hz, peak {np.max(np.abs(mix)):.3f}')
