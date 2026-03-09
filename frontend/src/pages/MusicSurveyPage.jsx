    import { useState } from "react";
    import { useNavigate } from "react-router-dom";

    const genres = [
    { name: "Pop", icon: "🎤" },
    { name: "Reggaetón", icon: "🔥" },
    { name: "Hip-Hop", icon: "🎧" },
    { name: "Rap", icon: "🎙️" },
    { name: "Rock", icon: "🎸" },
    { name: "Electrónica", icon: "🎛️" },
    { name: "Alternativo", icon: "🎶" },
    { name: "Clásica", icon: "🎻" },
    { name: "Reggae", icon: "🌴" },
    { name: "Dancehall", icon: "💃" },
    { name: "Regional", icon: "🤠" },
    { name: "Baladas", icon: "❤️" },
    ];

    const moods = [
    { name: "Chill", icon: "🌙" },
    { name: "Latina", icon: "💃" },
    { name: "Tristeza", icon: "🥀" },
    { name: "Nostalgia", icon: "🕰️" },
    { name: "Serenidad", icon: "🌊" },
    { name: "Alegría", icon: "😄" },
    { name: "Amor", icon: "💖" },
    { name: "Despecho", icon: "💔" },
    { name: "Romance", icon: "🌹" },
    { name: "Mariachi", icon: "🎺" },
    ];

    export default function MusicSurveyPage() {
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedMoods, setSelectedMoods] = useState([]);

    const navigate = useNavigate();

    function toggle(item, list, setList) {
        if (list.includes(item)) {
        setList(list.filter((i) => i !== item));
        } else {
        setList([...list, item]);
        }
    }

    function handleContinue() {
        const preferences = {
        genres: selectedGenres,
        moods: selectedMoods,
        };

        localStorage.setItem("musicPreferences", JSON.stringify(preferences));

        navigate("/dashboard");
    }

    return (
        <div className="survey-page">
        <h1>🎵 Personaliza tu música</h1>
        <p>Selecciona lo que más te gusta para tu entrenamiento</p>

        <h2>¿Qué géneros te gustan?</h2>

        <div className="options-grid">
            {genres.map((g) => (
            <div
                key={g.name}
                className={`option-card ${selectedGenres.includes(g.name) ? "active" : ""}`}
                onClick={() => toggle(g.name, selectedGenres, setSelectedGenres)}
            >
                <span className="icon">{g.icon}</span>
                {g.name}
            </div>
            ))}
        </div>

        <h2>¿Qué mood te motiva?</h2>

        <div className="options-grid">
            {moods.map((m) => (
            <div
                key={m.name}
                className={`option-card ${selectedMoods.includes(m.name) ? "active" : ""}`}
                onClick={() => toggle(m.name, selectedMoods, setSelectedMoods)}
            >
                <span className="icon">{m.icon}</span>
                {m.name}
            </div>
            ))}
        </div>

        <button className="continue-btn" onClick={handleContinue}>
            Continuar al Dashboard
        </button>
        </div>
    );
    }
