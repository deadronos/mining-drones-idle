const UINT32_MAX: f64 = u32::MAX as f64;

#[derive(Clone, Debug)]
pub struct Mulberry32 {
    state: i32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self {
            state: normalize_seed(seed),
        }
    }

    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6d2b_79f5_u32 as i32);
        let mut t = (self.state ^ ((self.state as u32) >> 15) as i32).wrapping_mul(self.state | 1);
        t ^= t.wrapping_add((t ^ ((t as u32) >> 7) as i32).wrapping_mul(t | 61));
        (t ^ ((t as u32) >> 14) as i32) as u32
    }

    pub fn next_f32(&mut self) -> f32 {
        (self.next_u32() as f64 / (UINT32_MAX + 1.0)) as f32
    }

    pub fn next_range(&mut self, mut min: f32, mut max: f32) -> Result<f32, &'static str> {
        if !min.is_finite() || !max.is_finite() {
            return Err("min and max must be finite numbers");
        }
        if max < min {
            core::mem::swap(&mut min, &mut max);
        }
        Ok(min + self.next_f32() * (max - min))
    }

    pub fn next_int(&mut self, min: i32, max: i32) -> Result<i32, &'static str> {
        let floor_min = min.min(max);
        let floor_max = max.max(min);
        if floor_max < floor_min {
            return Ok(floor_min);
        }
        let span = (i64::from(floor_max) - i64::from(floor_min) + 1) as f64;
        let sample = (self.next_f32() as f64 * span).floor() as i32;
        Ok(floor_min + sample)
    }

    pub fn seed(&self) -> u32 {
        self.state as u32
    }
}

fn normalize_seed(seed: u32) -> i32 {
    let normalized = if seed == 0 { 1 } else { seed };
    normalized as i32
}

#[cfg(test)]
mod tests {
    use super::Mulberry32;

    #[test]
    fn matches_typescript_sequence_for_seed_one() {
        let mut rng = Mulberry32::new(1);
        let expected = [
            0.627_073_94,
            0.002_735_721_2,
            0.527_447_04,
            0.981_050_97,
            0.968_377_9,
            0.281_103_5,
            0.612_838_86,
            0.720_743_16,
            0.425_796_96,
            0.994_822_9,
        ];
        for value in expected {
            let sample = rng.next_f32();
            assert!(
                (sample - value).abs() < 0.000_01,
                "expected {value}, got {sample}"
            );
        }
    }

    #[test]
    fn matches_typescript_sequence_for_large_seed() {
        let mut rng = Mulberry32::new(123_456_789);
        let expected = [
            0.257_790_74,
            0.970_772_1,
            0.785_328,
            0.206_164_58,
            0.303_071_9,
            0.747_066_1,
            0.778_733_7,
            0.284_509_63,
            0.016_536_935,
            0.161_464_69,
        ];
        for value in expected {
            let sample = rng.next_f32();
            assert!(
                (sample - value).abs() < 0.000_01,
                "expected {value}, got {sample}"
            );
        }
    }

    #[test]
    fn supports_integer_ranges() {
        let mut rng = Mulberry32::new(99);
        let expected = [-1, 2, 1, 2, -2, 2, -2, -2];
        for value in expected {
            let sample = rng.next_int(-2, 3).expect("range should be valid");
            assert_eq!(sample, value);
        }
    }
}
