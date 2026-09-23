(() => {
  for (const id of Object.keys(WarData.common)) SoundFX.play('skill', { id });
  SoundFX.stop();
  for (const character of Object.keys(WarData.characters)) {
    SoundFX.play('skill', { id: 'signature', character });
    SoundFX.stop();
  }
  SoundFX.play('launch');
  SoundFX.setVolume(0);
  SoundFX.setVolume(0.55);
  SoundFX.stop();
  return {
    signatures: Object.keys(SoundFX.signatures).length,
    voices: SoundFX.activeVoices,
  };
})();
