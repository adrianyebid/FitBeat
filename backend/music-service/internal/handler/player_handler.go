package handler

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

const spotifyPlayerURL = "https://api.spotify.com/v1/me/player"

type PlayerHandler struct {
	httpClient *http.Client
}

func NewPlayerHandler() *PlayerHandler {
	return &PlayerHandler{httpClient: &http.Client{}}
}

type playRequest struct {
	URIs []string `json:"uris"`
}

func (h *PlayerHandler) Play(c *gin.Context) {
	var req playRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid JSON payload", nil))
		return
	}

	body, _ := json.Marshal(req)
	h.proxyToSpotify(c, http.MethodPut, spotifyPlayerURL+"/play", body)
}

func (h *PlayerHandler) Pause(c *gin.Context) {
	h.proxyToSpotify(c, http.MethodPut, spotifyPlayerURL+"/pause", nil)
}

func (h *PlayerHandler) Next(c *gin.Context) {
	h.proxyToSpotify(c, http.MethodPost, spotifyPlayerURL+"/next", nil)
}

func (h *PlayerHandler) Previous(c *gin.Context) {
	h.proxyToSpotify(c, http.MethodPost, spotifyPlayerURL+"/previous", nil)
}

func (h *PlayerHandler) proxyToSpotify(c *gin.Context, method, url string, body []byte) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, errorResponse("missing Authorization header", nil))
		return
	}

	var reqBody *bytes.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), method, url, reqBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("failed to build spotify request", nil))
		return
	}

	req.Header.Set("Authorization", authHeader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, errorResponse("failed to reach Spotify", nil))
		return
	}
	defer resp.Body.Close()

	// Spotify devuelve 204 No Content en operaciones exitosas (pause, next, previous)
	if resp.StatusCode == http.StatusNoContent {
		c.Status(http.StatusNoContent)
		return
	}

	// Propagar la respuesta de Spotify tal cual (errores 4xx/5xx)
	var spotifyResp any
	if err := json.NewDecoder(resp.Body).Decode(&spotifyResp); err != nil {
		c.Status(resp.StatusCode)
		return
	}
	c.JSON(resp.StatusCode, spotifyResp)
}
