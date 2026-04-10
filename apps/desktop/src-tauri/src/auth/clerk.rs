use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Default, Clone, Copy)]
pub struct ClerkAuth;

impl ClerkAuth {
    pub async fn validate_jwt(&self, jwt: &str) -> Result<bool, String> {
        let token = jwt.trim();
        if token.is_empty() {
            return Err("jwt cannot be empty".to_string());
        }

        let segments = token.split('.').collect::<Vec<_>>();
        if segments.len() != 3 || segments.iter().any(|segment| segment.is_empty()) {
            return Ok(false);
        }

        let Some(header_bytes) = decode_base64url(segments[0]) else {
            return Ok(false);
        };
        let Some(payload_bytes) = decode_base64url(segments[1]) else {
            return Ok(false);
        };
        if decode_base64url(segments[2]).is_none() {
            return Ok(false);
        }

        let Ok(header) = serde_json::from_slice::<Value>(&header_bytes) else {
            return Ok(false);
        };
        if !header.is_object() {
            return Ok(false);
        }

        let Ok(payload) = serde_json::from_slice::<Value>(&payload_bytes) else {
            return Ok(false);
        };
        let Some(payload_obj) = payload.as_object() else {
            return Ok(false);
        };

        if let Some(exp_claim) = payload_obj.get("exp") {
            let Some(expiry_epoch_seconds) = parse_exp_claim(exp_claim) else {
                return Ok(false);
            };

            let now_epoch_seconds = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as f64;
            if expiry_epoch_seconds <= now_epoch_seconds {
                return Ok(false);
            }
        }

        Ok(true)
    }
}

fn parse_exp_claim(claim: &Value) -> Option<f64> {
    match claim {
        Value::Number(number) => number.as_f64(),
        _ => None,
    }
}

fn decode_base64url(value: &str) -> Option<Vec<u8>> {
    if value.is_empty() {
        return None;
    }

    let mut normalized = value.replace('-', "+").replace('_', "/");
    match normalized.len() % 4 {
        0 => {}
        2 => normalized.push_str("=="),
        3 => normalized.push('='),
        _ => return None,
    }

    decode_base64_standard(&normalized)
}

fn decode_base64_standard(value: &str) -> Option<Vec<u8>> {
    if value.is_empty() || value.len() % 4 != 0 {
        return None;
    }

    let mut output = Vec::with_capacity((value.len() / 4) * 3);
    for block in value.as_bytes().chunks_exact(4) {
        let v0 = decode_base64_char(block[0])?;
        let v1 = decode_base64_char(block[1])?;
        let v2 = decode_base64_char(block[2])?;
        let v3 = decode_base64_char(block[3])?;

        if v0 >= 64 || v1 >= 64 {
            return None;
        }
        if v2 == 64 && v3 != 64 {
            return None;
        }

        let b0 = (v0 << 2) | (v1 >> 4);
        output.push(b0);

        if v2 < 64 {
            let b1 = ((v1 & 0b0000_1111) << 4) | (v2 >> 2);
            output.push(b1);
        }

        if v3 < 64 {
            let b2 = ((v2 & 0b0000_0011) << 6) | v3;
            output.push(b2);
        }
    }

    Some(output)
}

fn decode_base64_char(input: u8) -> Option<u8> {
    match input {
        b'A'..=b'Z' => Some(input - b'A'),
        b'a'..=b'z' => Some(input - b'a' + 26),
        b'0'..=b'9' => Some(input - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        b'=' => Some(64),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn encode_base64url(bytes: &[u8]) -> String {
        const TABLE: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let mut output = String::new();

        for chunk in bytes.chunks(3) {
            let b0 = chunk[0];
            let b1 = *chunk.get(1).unwrap_or(&0);
            let b2 = *chunk.get(2).unwrap_or(&0);

            output.push(TABLE[(b0 >> 2) as usize] as char);
            output.push(TABLE[((b0 & 0b0000_0011) << 4 | (b1 >> 4)) as usize] as char);
            if chunk.len() > 1 {
                output.push(TABLE[((b1 & 0b0000_1111) << 2 | (b2 >> 6)) as usize] as char);
            }
            if chunk.len() > 2 {
                output.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
            }
        }

        output
    }

    fn token_with_json_segments(header_json: &str, payload_json: &str) -> String {
        let signature = encode_base64url(b"signature-bytes");
        format!(
            "{}.{}.{}",
            encode_base64url(header_json.as_bytes()),
            encode_base64url(payload_json.as_bytes()),
            signature
        )
    }

    #[test]
    fn decode_base64url_handles_paddingless_values() {
        let decoded = decode_base64url("aGVsbG8").expect("paddingless base64url should decode");
        assert_eq!(decoded, b"hello");
    }

    #[test]
    fn decode_base64url_rejects_invalid_inputs() {
        assert!(decode_base64url("").is_none());
        assert!(decode_base64url("abcde").is_none());
        assert!(decode_base64url("bad*chars").is_none());
    }

    #[test]
    fn parse_exp_claim_only_accepts_numbers() {
        assert_eq!(parse_exp_claim(&json!(1234)), Some(1234.0));
        assert_eq!(parse_exp_claim(&json!("1234")), None);
        assert_eq!(parse_exp_claim(&json!(null)), None);
    }

    #[tokio::test]
    async fn validate_jwt_rejects_empty_token() {
        let auth = ClerkAuth;
        let error = auth
            .validate_jwt("   ")
            .await
            .expect_err("empty JWT should fail validation");
        assert_eq!(error, "jwt cannot be empty");
    }

    #[tokio::test]
    async fn validate_jwt_rejects_invalid_structure_and_segments() {
        let auth = ClerkAuth;
        assert!(!auth.validate_jwt("only-two-segments.here").await.unwrap());
        assert!(!auth.validate_jwt("a..c").await.unwrap());
        assert!(!auth.validate_jwt("bad*.a.b").await.unwrap());
    }

    #[tokio::test]
    async fn validate_jwt_requires_header_and_payload_objects() {
        let auth = ClerkAuth;

        let non_object_header = token_with_json_segments(r#""header""#, r#"{"sub":"user_1"}"#);
        assert!(!auth.validate_jwt(&non_object_header).await.unwrap());

        let non_object_payload =
            token_with_json_segments(r#"{"alg":"none"}"#, r#"["not","an","object"]"#);
        assert!(!auth.validate_jwt(&non_object_payload).await.unwrap());
    }

    #[tokio::test]
    async fn validate_jwt_accepts_valid_token_without_exp() {
        let auth = ClerkAuth;
        let token =
            token_with_json_segments(r#"{"alg":"none","typ":"JWT"}"#, r#"{"sub":"user_1"}"#);
        assert!(auth.validate_jwt(&token).await.unwrap());
    }

    #[tokio::test]
    async fn validate_jwt_applies_expiry_rules() {
        let auth = ClerkAuth;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let future_payload = format!(r#"{{"sub":"user_1","exp":{}}}"#, now + 3600);
        let future_token = token_with_json_segments(r#"{"alg":"none"}"#, &future_payload);
        assert!(auth.validate_jwt(&future_token).await.unwrap());

        let expired_payload = format!(r#"{{"sub":"user_1","exp":{}}}"#, now.saturating_sub(5));
        let expired_token = token_with_json_segments(r#"{"alg":"none"}"#, &expired_payload);
        assert!(!auth.validate_jwt(&expired_token).await.unwrap());

        let non_numeric_exp =
            token_with_json_segments(r#"{"alg":"none"}"#, r#"{"sub":"user_1","exp":"later"}"#);
        assert!(!auth.validate_jwt(&non_numeric_exp).await.unwrap());
    }
}
