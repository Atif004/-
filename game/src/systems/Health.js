// نظام الصحة: ضرر، مناعة مؤقتة بعد الضربة، وأحداث.

export class Health {
  constructor(max = 100) {
    this.max = max;
    this.value = max;
    this.invuln = 0;
    this.onDamage = null;
    this.onDeath = null;
  }
  get dead() { return this.value <= 0; }
  get ratio() { return this.value / this.max; }

  update(dt) { if (this.invuln > 0) this.invuln -= dt; }

  damage(amount, source) {
    if (this.dead || this.invuln > 0) return false;
    this.value = Math.max(0, this.value - amount);
    this.invuln = 0.9;
    this.onDamage?.(amount, source);
    if (this.dead) this.onDeath?.(source);
    return true;
  }

  heal(amount) { this.value = Math.min(this.max, this.value + amount); }
}
