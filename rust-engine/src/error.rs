use thiserror::Error;

#[derive(Debug, Error)]
pub enum SimulationError {
    #[error("missing field: {0}")]
    MissingField(&'static str),
    #[error("failed to parse snapshot: {0}")]
    ParseFailure(String),
    #[error("invalid layout: {0}")]
    InvalidLayout(String),
    #[error("command error: {0}")]
    CommandError(String),
}

impl SimulationError {
    pub fn parse(err: impl ToString) -> Self {
        SimulationError::ParseFailure(err.to_string())
    }
}
