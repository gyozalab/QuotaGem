use crate::models::UsageSnapshot;
use async_trait::async_trait;

#[async_trait]
pub trait Provider {
    async fn snapshot(&self) -> anyhow::Result<UsageSnapshot>;
}
