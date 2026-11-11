# Breadboard Bench

A study bench for ELT 1206 (AC/DC fundamentals): build a circuit on a breadboard, read the meters, and check the math. Built to sit beside LTspice: quick answers and practice here, detailed simulation there.

Open `app/index.html` in a browser. There is no build step and no dependencies.

## What it does

**Breadboard.** A half-size breadboard (30 columns, two rail pairs). The top ribbon has one button per kind of part the course uses: resistor, capacitor, inductor, potentiometer, switch, DC supply, AC source, diode, LED and op-amp. Picking one opens the inspector under the board with a one-line explanation, how to put it in, a few plain choices and common values. Two-lead parts go between two holes; the pot and DIP-8 op-amps drop in with one click using their real pinouts. The op-amps are the LM1458 used in class (dual, ±12 V), the LM741 and the single-supply LM358. Parts already on the board can be dragged to a new place, or stretched by dragging one end; Undo and Redo (Ctrl+Z, Ctrl+Shift+Z) step through every change.

The circuit is solved with modified nodal analysis (Newton–Raphson for diodes, LEDs and op-amps):

- DC: every node voltage, and each part's voltage, current and power.
- AC: rms phasors (magnitude and angle) at any frequency.
- Checks: resistor wattage, LED current, op-amp supply and clipping, plus wiring notes for shorted parts and leads that connect to nothing.
- "Copy for LTspice" copies the board as a SPICE netlist.
- "Import LTspice" goes the other way: drop a schematic (.asc) or netlist (.net, .cir) onto the board, open one, paste the netlist into the box, or just press Ctrl+V on the bench. Files saved as UTF-16 or Windows-1252 (older LTspice versions) are read correctly. Resistors, capacitors, inductors, diodes, LEDs, DC and sine sources (with their DC offset) and op-amps come across, `.param` values are filled in, and anything else is listed as skipped. The parts are laid out the way you would build them: ground and the supplies on the rails, each other node on its own column, parts lying along a row or standing between a column and a rail, op-amps as DIP-8 chips. The finished board is checked against the netlist before it is shown, the LTspice node names are printed on the board and listed above it, and Undo brings the old board back.

**Instruments.** The multimeter and the oscilloscope sit beside the board. Their probes rest in a tray under the board: drag one onto a hole (the reading follows while you drag), drag it back to lift it, or tap it and then tap a hole. "Meter it" and "Scope it" on a selected part place the probes for you. Both instruments read the live circuit, DC levels and the AC sine together, whichever readings (DC or AC) the board is showing.

**Multimeter.** A 6000-count true-RMS handheld laid out like the Fluke 87V used on the bench. Turn the dial (V~, V⎓, mV, Ω, diode, mA/A, µA), plug the red lead into the VΩ, mA/µA or A jack, and put the red and black probes on the board. It reads what a real meter would:

- Volts with a 10 MΩ input across the probes. V~ is AC-coupled true rms, so it reads 0 on a DC circuit, and V⎓ reads the DC average, so it reads 0 on a pure sine. The meter says so when the dial is on the wrong one.
- Ω, continuity (yellow button, beeps below 25 Ω), diode test (about 1 mA, OL when reversed) and capacitance (yellow button on the diode position) are measured with the supplies switched off, so a resistor reads correctly in circuit only when nothing else is in parallel with it.
- Current only flows through the meter when it is in series (break the circuit and bridge the gap with the probes). The shunts have the real burden (1.8 Ω on mA, 100 Ω on µA), and more than 440 mA through the mA jack blows its fuse. Leaving the red lead in a current jack with the dial on volts shows LEAd.
- RANGE (hold to return to auto), HOLD, MIN MAX (hold to stop), REL Δ and Hz work as on the meter.

**Oscilloscope.** A two-channel bench scope beside the meter ("Scope" button), with CH1 and CH2 tips and a ground clip. A trace that lands off the screen is brought into view when its probe is placed. Each channel has V/div, position, AC/DC coupling and on/off; there are time/div, a rising-edge trigger on either channel with a level, Auto scale and MATH (CH1 − CH2). The bottom of the screen shows Vpp, Vrms and frequency for each channel and the phase and time shift of CH2 against CH1. The inputs are 1 MΩ to the ground clip, and the ground clip is earth, like the circuit's ground: clipping it onto any other node shorts that node to ground, as it would on the bench. Traces come from the DC operating point plus the AC phasor. A tip on an op-amp output shows the sine flattened where it runs into the chip's output swing limits, and the screen flags it as CLIP; diodes and LEDs are small-signal.

**Homework.** The "Solving AC circuits two ways" homework (series RLC, parallel RC, series-parallel): every step from the sheet with an answer box that takes rectangular (30 + j40) or polar (50∠53.13, or 50<53.13) answers, checks them within 1%, and says what is off (wrong angle sign, 180° off, wrong magnitude). Each step can show its ✔ line and worked solution, and each circuit has its "think about it" question with a model answer. "Build it on the breadboard" loads the circuit at 1 kHz (L and C chosen to give the homework's reactances) with the scope probes placed, and the sample panel compares the homework answers with the board's readings.

**Sample circuits.** Eleven worked examples, plus the three homework circuits, in course order: an LED, divider and RC filter; a series circuit and KVL (quiz question 4); a series-parallel circuit (quiz question 5); a loaded divider; two sources with superposition; a Wheatstone bridge; an RC high-pass filter; series RLC resonance; non-inverting and inverting op-amp amplifiers; and the op-amp adder from the midterm practical (two LM1458s: buffers, a summing amplifier and an inverter on ±12 V). Each one explains what the circuit shows, what the readings should say, and what to change next. A test checks every sample against the numbers in its write-up.

**Calculators.** Each shows its answer and the worked steps, in the form used on the midterm crib sheet: Ohm's law and power, resistor color code, series and parallel, voltage divider and loading, RC and RL time constant, sine wave (Vp, Vpp, Vrms, f, T, ω), phasor converter (rectangular ↔ polar with the quadrant fix), reactance and impedance, and AC circuit two ways (enter series parts and a two-branch parallel group as R 30, XL 60, XC 20 and get Method 1 and Method 2 worked out, with the KVL / KCL check).

## Layout

- `app/index.html` – the user interface.
- `app/engine.js` – value handling, color codes, the parts list, the circuit solver and the sample circuits. It has no DOM dependencies.
- `tests/engine.test.js` – solver and formatting tests; `tests/devices.test.js` – device models, sample circuits and a random-circuit convergence check; `tests/import.test.js` – LTspice import; `tests/meter.test.js` – multimeter readings; `tests/homework.test.js` – every ✔ line of the AC homework and the homework circuits on the board; `tests/scope.test.js` – oscilloscope readings (`npm test`, Node 18 or later).
