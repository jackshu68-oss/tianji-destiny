/* 轻量 Web Audio 氛围音乐；仅在用户主动点击后播放。 */
(function () {
  'use strict';

  let context = null;
  let master = null;
  let playing = false;
  let timer = null;
  let nextNoteAt = 0;
  let step = 0;
  let drones = [];
  const melody = [0, 2, 4, 2, 1, 3, 4, 1, 0, 2, 3, 1, 4, 3, 2, 0];
  const scale = [220.00, 261.63, 293.66, 329.63, 392.00];

  function audioClass() {
    return window.AudioContext || window.webkitAudioContext;
  }

  function ensureGraph() {
    if (context) return true;
    const AudioContextClass = audioClass();
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.connect(context.destination);
    return true;
  }

  function tone(frequency, start, duration, level, type) {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1450, start);
    filter.Q.setValueAtTime(0.7, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(master);
    oscillator.start(start); oscillator.stop(start + duration + 0.05);
  }

  function pad(root, start) {
    [1, 1.25, 1.5].forEach((ratio, index) => tone(root * ratio, start, 4.8, 0.018 / (index + 1), 'sine'));
  }

  function createDrones() {
    drones = [110, 164.81].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      oscillator.type = index ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass'; filter.frequency.value = 420;
      gain.gain.value = index ? 0.012 : 0.018;
      oscillator.connect(filter); filter.connect(gain); gain.connect(master);
      oscillator.start();
      return { oscillator, gain };
    });
  }

  function schedule() {
    if (!playing) return;
    while (nextNoteAt < context.currentTime + 0.45) {
      const note = melody[step % melody.length];
      tone(scale[note], nextNoteAt, 2.1, 0.052, step % 4 === 0 ? 'triangle' : 'sine');
      if (step % 4 === 0) pad(scale[note] / 2, nextNoteAt);
      if (step % 8 === 6) tone(scale[(note + 2) % scale.length] * 2, nextNoteAt + 0.45, 1.4, 0.018, 'sine');
      nextNoteAt += 1.65;
      step += 1;
    }
    timer = window.setTimeout(schedule, 140);
  }

  function updateButton(button) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? '关闭舒缓音乐' : '播放舒缓音乐');
    button.title = playing ? '关闭舒缓音乐' : '播放舒缓音乐';
  }

  async function start(button) {
    if (!ensureGraph()) {
      button.title = '此浏览器不支持网页音乐';
      return;
    }
    if (context.state === 'suspended') {
      await Promise.race([
        context.resume().catch(() => {}),
        new Promise(resolve => window.setTimeout(resolve, 700))
      ]);
    }
    playing = true;
    step = 0;
    nextNoteAt = context.currentTime + 0.05;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.72, context.currentTime + 1.2);
    createDrones();
    schedule();
    updateButton(button);
  }

  function stop(button) {
    playing = false;
    window.clearTimeout(timer);
    timer = null;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    drones.forEach(node => {
      try { node.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7); node.oscillator.stop(now + 0.85); } catch (_error) {}
    });
    drones = [];
    window.setTimeout(() => { if (!playing && context && context.state === 'running') context.suspend(); }, 950);
    updateButton(button);
  }

  function init() {
    const button = document.getElementById('music-toggle');
    if (!button) return;
    button.addEventListener('click', async () => {
      try {
        if (playing) stop(button);
        else await start(button);
      } catch (_error) {
        playing = false;
        updateButton(button);
        button.title = '音乐启动失败，请再次点击';
      }
    });
  }

  window.TianjiAmbient = { isPlaying: () => playing };
  window.addEventListener('DOMContentLoaded', init);
})();
