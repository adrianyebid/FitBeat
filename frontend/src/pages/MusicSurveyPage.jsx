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
    { name: "Regional Mexicana", icon: "🤠" },
    { name: "Baladas", icon: "❤️" }
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
    { name: "Mariachi", icon: "🎺" }
    ];

    function MusicSurveyPage() {

    const [step, setStep] = useState(1);
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedMoods, setSelectedMoods] = useState([]);

    const navigate = useNavigate();

    function toggle(item, list, setList) {

        if (list.includes(item)) {
        setList(list.filter(i => i !== item));
        } else {
        setList([...list, item]);
        }

    }

    function nextStep() {
        setStep(2);
    }

    function prevStep() {
        setStep(1);
    }

    function finishSurvey() {

        const preferences = {
        genres: selectedGenres,
        moods: selectedMoods
        };

        localStorage.setItem("musicPreferences", JSON.stringify(preferences));

        navigate("/dashboard");

    }

    return (

        <main className="survey-layout">

        <section className="survey-card">

            <div className="survey-header">
            <h1>🎵 Personaliza tu música</h1>
            <p>Selecciona lo que más te motiva para entrenar</p>
            </div>

            {step === 1 && (

            <>
                <h2 className="survey-question">¿Qué géneros te gustan?</h2>

                <div className="options-grid">

                {genres.map((g) => (

                    <div
                    key={g.name}
                    className={`option-card ${selectedGenres.includes(g.name) ? "active" : ""}`}
                    onClick={() => toggle(g.name, selectedGenres, setSelectedGenres)}
                    >

                    <span className="icon">{g.icon}</span>
                    <span>{g.name}</span>

                    </div>

                ))}

                </div>

                <div className="survey-buttons">

                <div />

                <button className="continue-btn" onClick={nextStep}>
                    Siguiente →
                </button>

                </div>

            </>

            )}

            {step === 2 && (

            <>
                <h2 className="survey-question">¿Qué mood te motiva?</h2>

                <div className="options-grid">

                {moods.map((m) => (

                    <div
                    key={m.name}
                    className={`option-card ${selectedMoods.includes(m.name) ? "active" : ""}`}
                    onClick={() => toggle(m.name, selectedMoods, setSelectedMoods)}
                    >

                    <span className="icon">{m.icon}</span>
                    <span>{m.name}</span>

                    </div>

                ))}

                </div>

                <div className="survey-buttons">

                <button className="back-btn" onClick={prevStep}>
                    ← Atrás
                </button>

                <button className="continue-btn" onClick={finishSurvey}>
                    Ir al Dashboard
                </button>

                </div>

            </>

            )}

        </section>

        </main>

    );
    }

    export default MusicSurveyPage;