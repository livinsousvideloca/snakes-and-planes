# Breadboard Bench

A study bench for ELT 1206 (AC/DC fundamentals): build a circuit on a breadboard, read the meters, and check the math. Built to sit beside LTspice: quick answers and practice here, detailed simulation there.

Open `app/index.html` in a browser. There is no build step and no dependencies.

## What it does

**Breadboard.** A half-size breadboard (30 columns, two rail pairs). The top ribbon has one button per kind of part the course uses: resistor, capacitor, inductor, potentiometer, switch, DC supply, AC source, diode, LED and op-amp. Picking one opens a row underneath with a one-line explanation, how to put it in, a few plain choices and common values. Two-lead parts go between two holes; the pot and DIP-8 op-amps drop in with one click using their real pinouts. The op-amps are the LM1458 used in class (dual, ±12 V), the LM741 and the single-supply LM358.

The circuit is solved with modified nodal analysis (Newton–Raphson for diodes, LEDs and op-amps):

- DC: every node voltage, and each part's voltage, current and power.
- AC: rms phasors (magnitude and angle) at any frequency.
- Checks: resistor wattage, LED current, op-amp supply and clipping, plus wiring notes for shorted parts and leads that connect to nothing.
- "Copy for LTspice" copies the board as a SPICE netlist.

**Sample circuits.** Ten worked examples in course order: an LED, divider and RC filter; a series circuit and KVL (quiz question 4); a series-parallel circuit (quiz question 5); a loaded divider; two sources with superposition; a Wheatstone bridge; an RC high-pass filter; series RLC resonance; and non-inverting and inverting op-amp amplifiers. Each one explains what the circuit shows, what the readings should say, and what to change next. A test checks every sample against the numbers in its write-up.

**Calculators.** Each shows its answer and the worked steps, in the form used on the midterm crib sheet: Ohm's law and power, resistor color code, series and parallel, voltage divider and loading, RC and RL time constant, sine wave (Vp, Vpp, Vrms, f, T, ω), phasor converter (rectangular ↔ polar with the quadrant fix), and reactance and impedance.

## Layout

- `app/index.html` – the user interface.
- `app/engine.js` – value handling, color codes, the parts list, the circuit solver and the sample circuits. It has no DOM dependencies.
- `tests/engine.test.js` – solver and formatting tests; `tests/devices.test.js` – device models, sample circuits and a random-circuit convergence check (`npm test`, Node 18 or later).
