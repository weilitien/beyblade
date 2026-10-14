(() => {
  for (const id of Object.keys(WarData.common)) SoundFX.play('skill', { id });
  SoundFX.stop();
  for (const character of Object.keys(WarData.characters)) {
    SoundFX.play('skill', { id: 'signature', character });
    SoundFX.stop();
  }
  for (const character of ['guanyu', 'lubu', 'huangzhong']) {
    SoundFX.stop();
    SoundFX.play('signature-hit', {character});
    const count = SoundFX.activeVoices;
    if (!count) throw Error(character + ' impact is silent');
    for (let i=0;i<40;i++) SoundFX.play('signature-hit', {character});
    if (SoundFX.activeVoices !== count) throw Error('Ultimate impacts must be throttled');
    SoundFX.stop();
    SoundFX.play(character === 'huangzhong' ? 'arrow' : 'signature-release', {character, final:true});
    if (!SoundFX.activeVoices) throw Error(character + ' release is silent');
  }
  SoundFX.play('arrow');
  SoundFX.play('launch');
  SoundFX.setVolume(0);
  SoundFX.setVolume(0.55);
  SoundFX.stop();
  return {
    signatures: Object.keys(SoundFX.signatures).length,
    voices: SoundFX.activeVoices,
  };
})();
