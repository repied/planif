A free and open source application for planning 2 dives, with MN90 tables or Gradient Factors (Bühlmann ZHL-16C).

<div class="disclaimer-box">

**SAFETY WARNING**

Educational tool. The results presented may be wrong. Use a certified dive computer and follow safety rules.

</div>

### Usage

- **Drag up/down** or **Tap** to adjust
- **Double tap** to reset
- **Lock icon** to unlock GFs
- Toggle **ppO<sub>2</sub> max** between 1.4 and 1.6 to adjust the Maximum Operating Depth (MOD).
- **Over-penalize second dive** limiting off-gassing of fast compartments.
- **Target** duration to not use reserve (orange tick on tank gauge).
- **Share:** via link or QR code
- **Calculations & Details:**
  - **TTS:** Time To Surface
  - **Takeoff pressure:** Pressure at the beginning of the ascent.
  - **End pressure:** Final tank pressure
  - **MOD Warning:** An orange arc appears on the depth gauge when exceeding the selected ppO<sub>2</sub> limit.

### Assumptions

- Recreational square dive at sea level, salt water, no safety stop
- **Descent:** 20 m/min
- **Ascent:** **15 m/min** for MN90, **10 m/min** for GF and **6 m/min** between stops for both

### Installation

Direct installation from the browser (no PlayStore/AppStore) for offline usage.

- **Android/Computer:**
  - Use the install prompt or the '+' icon in the address bar.
- **iOS:**
  - In Safari, tap Share -> 'Add to Home Screen'.

### References

- Design inspired by [mn•90](https://oliviernemoz.wixsite.com/site/mn90)
- MN90 tables: [eppeplongee](https://eppeplongee.wordpress.com/2018/03/22/tables-mn-90/)
- ZH-L16C parameters: [Subsurface](https://github.com/subsurface/subsurface/blob/dfd5e20d3d2b7105e89ded44222dc6f1631d2a39/core/deco.cpp#L86)
- Over-penalisation: [A. Foret](./data/Worldivers-Computers-Repetitive-FR.pdf)
- Source: [code](https://github.com/repied/tables)
- Contact: [pierreD](mailto:pierre.dangauthier+tables@gmail.com?subject=Tables%20app%20feedback)
- Validation [plans vs subsurface](comp.html)
- Extra: [Checklist](#checklist)
