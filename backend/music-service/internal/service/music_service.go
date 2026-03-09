package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/adrianyebid/fitbeat/music-service/internal/model"
	"github.com/adrianyebid/fitbeat/music-service/internal/repository"
)

var (
	ErrSessionNotFound = errors.New("session not found")
	ErrNoTrackCatalog  = errors.New("no tracks available for intensity")
)

type CreateSessionInput struct {
	UserID       string
	ActivityType string
	Mode         string
}

type ProcessBiometricInput struct {
	SessionID string
	HeartRate int
}

// EngineService implementa la lógica de sesiones, biométricos y decisión musical.
type EngineService struct {
	repo          repository.EngineRepository
	catalog       map[string][]model.Track
	catalogCursor map[string]int
	mu            sync.Mutex
	idCounter     uint64
}

func NewEngineService(repo repository.EngineRepository) *EngineService {
	return &EngineService{
		repo:          repo,
		catalog:       buildMockCatalog(),
		catalogCursor: map[string]int{},
	}
}

func (s *EngineService) CreateSession(input CreateSessionInput) (model.TrainingSession, error) {
	session := model.TrainingSession{
		ID:           s.nextID("session"),
		UserID:       strings.TrimSpace(input.UserID),
		ActivityType: strings.TrimSpace(input.ActivityType),
		Mode:         strings.TrimSpace(input.Mode),
		CreatedAt:    time.Now().UTC(),
	}

	if err := s.repo.SaveSession(session); err != nil {
		return model.TrainingSession{}, err
	}

	return session, nil
}

func (s *EngineService) ProcessBiometric(input ProcessBiometricInput) (model.TrackDecision, error) {
	_, err := s.repo.FindSessionByID(strings.TrimSpace(input.SessionID))
	if err != nil {
		if errors.Is(err, repository.ErrSessionNotFound) {
			return model.TrackDecision{}, ErrSessionNotFound
		}
		return model.TrackDecision{}, err
	}

	reading := model.BiometricData{
		ID:         s.nextID("biometric"),
		SessionID:  strings.TrimSpace(input.SessionID),
		HeartRate:  input.HeartRate,
		RecordedAt: time.Now().UTC(),
	}

	if err := s.repo.SaveBiometric(reading); err != nil {
		return model.TrackDecision{}, err
	}

	intensity := resolveIntensity(input.HeartRate)
	track, err := s.pickTrack(intensity)
	if err != nil {
		return model.TrackDecision{}, err
	}

	decision := model.TrackDecision{
		ID:             s.nextID("decision"),
		SessionID:      reading.SessionID,
		HeartRate:      reading.HeartRate,
		IntensityLevel: intensity,
		Track:          track,
		DecidedAt:      time.Now().UTC(),
	}

	if err := s.repo.SaveDecision(decision); err != nil {
		return model.TrackDecision{}, err
	}

	return decision, nil
}

func (s *EngineService) pickTrack(intensity string) (model.Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tracks := s.catalog[intensity]
	if len(tracks) == 0 {
		return model.Track{}, ErrNoTrackCatalog
	}

	idx := s.catalogCursor[intensity] % len(tracks)
	s.catalogCursor[intensity]++
	return tracks[idx], nil
}

func (s *EngineService) nextID(prefix string) string {
	n := atomic.AddUint64(&s.idCounter, 1)
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UTC().UnixNano(), n)
}

func resolveIntensity(heartRate int) string {
	if heartRate < 100 {
		return "low_intensity"
	}
	if heartRate < 140 {
		return "medium_intensity"
	}
	return "high_intensity"
}

func buildMockCatalog() map[string][]model.Track {
	return map[string][]model.Track{
		"low_intensity": {
			{ID: "low_1", Title: "Morning Flow", Artist: "FitBeat Mock", Duration: 210, Intensity: "low_intensity"},
			{ID: "low_2", Title: "Steady Breeze", Artist: "FitBeat Mock", Duration: 198, Intensity: "low_intensity"},
		},
		"medium_intensity": {
			{ID: "med_1", Title: "Cardio Drive", Artist: "FitBeat Mock", Duration: 185, Intensity: "medium_intensity"},
			{ID: "med_2", Title: "Pace Builder", Artist: "FitBeat Mock", Duration: 192, Intensity: "medium_intensity"},
		},
		"high_intensity": {
			{ID: "high_1", Title: "Sprint Mode", Artist: "FitBeat Mock", Duration: 176, Intensity: "high_intensity"},
			{ID: "high_2", Title: "Final Push", Artist: "FitBeat Mock", Duration: 168, Intensity: "high_intensity"},
		},
	}
}
