package handler

import (
	"crypto/hmac"
	"net/http"

	"github.com/gin-gonic/gin"
)

const internalTokenHeader = "X-Internal-Token"

// InternalSecretAuth returns a Gin middleware that validates the X-Internal-Token
// header against the shared secret for internal (S2S) routes.
//
// Uses crypto/hmac.Equal for constant-time comparison to mitigate timing attacks.
// Routes that don't match the /internal/ prefix should NOT use this middleware.
func InternalSecretAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"message": "internal secret not configured",
			})
			return
		}

		provided := c.GetHeader(internalTokenHeader)
		if provided == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"message": "missing " + internalTokenHeader + " header",
			})
			return
		}

		if !hmac.Equal([]byte(provided), []byte(secret)) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"message": "invalid internal token",
			})
			return
		}

		c.Next()
	}
}
