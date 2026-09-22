# Sound assets

The eight `.ogg` recordings in this directory are selected from [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), published under [CC0](https://kenney.nl/support). They are bundled locally so the game does not depend on an external audio service at runtime.

- `impactWood_medium_000/002/004.ogg`: ordinary piece landing variants.
- `impactWood_heavy_000/002/004.ogg`: capture impacts.
- `impactMetal_light_001.ogg`: short capture accent.
- `impactBell_heavy_001.ogg`: check and victory accent.

The Web Audio synthesis in `src/sound.js` provides layered ambience and a fallback if recorded samples fail to load.
