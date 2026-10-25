(function attachPersonalPawns(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdventurePersonalPawns = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPersonalPawns() {
  'use strict';
  const PROFILES = Object.freeze([
    ['mikeb', 'MikeB', 'MikeBs grip', '#38aeb0'],
    ['jerka', 'Jerka', 'Jerkas bergsbagge', '#9d3647'],
    ['zellmani', 'Zellmani', 'Zellmanis enhörning', '#66804c'],
    ['elliott-da-bomb', 'Elliott da bomb', 'Elliotts skogssköldpadda', '#b5a443'],
    ['nillebae', 'Nillebae', 'Nillebaes kungsgås', '#315aac'],
  ].map(([id, username, name, color]) => Object.freeze({
    id, username,
    mount: Object.freeze({ id, name, color, image: '/adventure/assets/players/' + id + '.webp' }),
  })));
  const normalize = value => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE') : '';
  const byName = new Map(PROFILES.map(profile => [normalize(profile.username), profile]));
  const byId = new Map(PROFILES.map(profile => [profile.id, profile]));
  const forName = username => byName.get(normalize(username)) || null;
  const forId = id => byId.get(id) || null;
  const canChoosePawn = username => !forName(username);
  return Object.freeze({ PROFILES, forName, forId, canChoosePawn });
}));
