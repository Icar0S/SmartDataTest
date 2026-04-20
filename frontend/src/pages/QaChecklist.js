import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronLeft, Trash2, CheckCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getApiUrl } from '../config/api';

// Questions structure matching backend QUESTIONS
const QUESTIONS = {
  "General": [
    "What is the name of the dataset you want to validate? (e.g., customer_data)",
    "What is the source of the data (e.g., a file path like /data/customer.csv, or a database table name like sales.customers)?",
    "What is the format of the data (e.g., CSV, JSON, Parquet, Delta)?"
  ],
  "Schema Validation": [
    "Does the data have a header? (yes/no)",
    "What are the expected column names, in order? (e.g., id, first_name, last_name, email)",
    "What is the expected data type for each column (e.g., integer, string, float, date)? Please list them in the same order as column names, separated by commas. (e.g., integer, string, string, string)"
  ],
  "Data Integrity": [
    "Which columns should not contain any missing values (i.e., are mandatory)? List them separated by commas. (e.g., id, email)",
    "Which columns should contain unique values (i.e., are primary keys)? List them separated by commas. (e.g., id, order_id)",
    "Are there any columns that should have a specific format (e.g., a date format like YYYY-MM-DD)? List as 'column:format', separated by commas. (e.g., registration_date:YYYY-MM-DD, transaction_time:HH:mm:ss)"
  ],
  "Value Constraints": [
    "Are there any columns that should have a minimum or maximum value? List as 'column:min:max', 'column::max', or 'column:min:', separated by commas. (e.g., age:18:99, price::1000, quantity:1:)",
    "Are there any columns that should only contain values from a specific set (e.g., a list of categories)? List as 'column:[value1,value2]', separated by '],'. (e.g., status:[active,inactive,pending], gender:[M,F,Other])",
    "Are there any columns that should match a specific regular expression pattern? List as 'column:pattern', separated by commas. (e.g., email:^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$, phone_number:^\\d{3}-\\d{3}-\\d{4}$)",
    "Are there any columns for which you want to check the value distribution (e.g., to ensure certain values appear with a specific frequency)? List as 'column:value:min_freq:max_freq', separated by commas. (e.g., status:active:0.7:1.0, status:inactive:0.0:0.1)"
  ],
  "Cross-Column Validation": [
    "Are there any relationships between two columns that should always hold true (e.g., 'start_date' must be before 'end_date', 'price' must be greater than 'cost')? List as 'column1:operator:column2', separated by commas. Supported operators: <, <=, >, >=, ==, !=. (e.g., start_date:<:end_date, price:>:cost)"
  ]
};

const QaChecklist = () => {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dsl, setDsl] = useState(null);
  const [pysparkCode, setPysparkCode] = useState('');
  const inputRef = useRef(null);
  
  const sections = Object.keys(QUESTIONS);
  const currentSectionName = sections[currentSection];
  const currentQuestions = QUESTIONS[currentSectionName];
  const currentQuestionText = currentQuestions[currentQuestion];
  const totalQuestions = sections.reduce((sum, section) => sum + QUESTIONS[section].length, 0);
  const answeredQuestions = Object.keys(answers).length;
  
  // Auto-focus on input when component mounts or question changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentSection, currentQuestion]);

  const handleAnswerChange = (e) => {
    setCurrentAnswer(e.target.value);
  };

  const handleNext = () => {
    // Save current answer
    if (currentAnswer.trim()) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestionText]: currentAnswer.trim()
      }));
    }

    // Move to next question
    if (currentQuestion < currentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      // Load saved answer for next question if exists
      const nextQuestion = currentQuestions[currentQuestion + 1];
      setCurrentAnswer(answers[nextQuestion] || '');
    } else if (currentSection < sections.length - 1) {
      // Move to next section
      setCurrentSection(currentSection + 1);
      setCurrentQuestion(0);
      const nextSectionQuestions = QUESTIONS[sections[currentSection + 1]];
      setCurrentAnswer(answers[nextSectionQuestions[0]] || '');
    }
  };

  const handlePrevious = () => {
    // Save current answer
    if (currentAnswer.trim()) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestionText]: currentAnswer.trim()
      }));
    }

    // Move to previous question
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = currentQuestions[currentQuestion - 1];
      setCurrentAnswer(answers[prevQuestion] || '');
    } else if (currentSection > 0) {
      // Move to previous section
      setCurrentSection(currentSection - 1);
      const prevSectionQuestions = QUESTIONS[sections[currentSection - 1]];
      setCurrentQuestion(prevSectionQuestions.length - 1);
      setCurrentAnswer(answers[prevSectionQuestions[prevSectionQuestions.length - 1]] || '');
    }
  };

  const handleSubmit = async () => {
    // Save current answer before submitting
    const finalAnswers = {
      ...answers,
      [currentQuestionText]: currentAnswer.trim()
    };

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(getApiUrl('/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: finalAnswers }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate JSON and PySpark code');
      }

      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        setError(`Errors: ${data.errors.map(e => e.message || e).join(', ')}`);
      }

      setDsl(data.dsl);
      setPysparkCode(data.pyspark_code);
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentSection(0);
    setCurrentQuestion(0);
    setAnswers({});
    setCurrentAnswer('');
    setIsSubmitted(false);
    setDsl(null);
    setPysparkCode('');
    setError(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLastQuestion) {
        handleSubmit();
      } else {
        handleNext();
      }
    }
  };

  const isFirstQuestion = currentSection === 0 && currentQuestion === 0;
  const isLastQuestion = currentSection === sections.length - 1 && 
                         currentQuestion === currentQuestions.length - 1;

  if (isSubmitted && dsl) {
    return (
      <div className="flex flex-col h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
          <h1 className="text-xl font-semibold text-white">Checklist de Testes QA</h1>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-800/50"
            aria-label="Limpar conversa"
          >
            <Trash2 className="w-5 h-5" />
            <span className="font-medium">Limpar</span>
          </button>
        </header>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl lg:max-w-7xl p-4 space-y-6">
            {/* Success message */}
            <div className="flex items-center gap-3 p-4 bg-green-900/30 border border-green-700/50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <p className="text-green-300 font-medium">JSON e código PySpark gerados com sucesso!</p>
            </div>

            {/* Error display */}
            {error && (
              <div className="p-4 text-red-300 bg-red-900/30 border border-red-700/50 rounded-lg backdrop-blur-sm">
                {error}
              </div>
            )}

            {/* DSL Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <h2 className="text-2xl font-bold text-white mb-4">JSON</h2>
              <div className="bg-gray-900/90 rounded-lg overflow-hidden">
                <SyntaxHighlighter
                  language="json"
                  style={materialDark}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent'
                  }}
                >
                  {JSON.stringify(dsl, null, 2)}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* PySpark Code Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <h2 className="text-2xl font-bold text-white mb-4">Código PySpark</h2>
              <div className="bg-gray-900/90 rounded-lg overflow-hidden">
                <SyntaxHighlighter
                  language="python"
                  style={materialDark}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent'
                  }}
                >
                  {pysparkCode}
                </SyntaxHighlighter>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Home</span>
        </Link>
        <h1 className="text-xl font-semibold text-white">Checklist de Testes QA</h1>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-800/50"
          aria-label="Limpar conversa"
        >
          <Trash2 className="w-5 h-5" />
          <span className="font-medium">Limpar</span>
        </button>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-5xl lg:max-w-7xl h-full flex flex-col p-4">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">
                Questão {answeredQuestions + 1} de {totalQuestions}
              </span>
              <span className="text-sm text-gray-400">
                {Math.round(((answeredQuestions) / totalQuestions) * 100)}% concluído
              </span>
            </div>
            <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
                style={{ width: `${(answeredQuestions / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Area */}
          <div className="flex-1 flex flex-col justify-center mb-4">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm font-medium mb-4">
                  {currentSectionName}
                </span>
                <h2 className="text-2xl font-bold text-white mb-6">
                  {currentQuestionText}
                </h2>
              </div>
              
              <textarea
                ref={inputRef}
                value={currentAnswer}
                onChange={handleAnswerChange}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua resposta aqui... (Enter para próxima, Shift+Enter para nova linha)"
                className="w-full p-4 bg-gray-900/90 text-white border border-gray-700/50 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="4"
                disabled={isLoading}
                aria-label="Campo de mensagem"
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3 justify-between">
            <button
              onClick={handlePrevious}
              disabled={isFirstQuestion || isLoading}
              className="flex items-center gap-2 px-6 py-3 text-white bg-gray-700 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Anterior</span>
            </button>

            {error && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Gerar JSON e PySpark</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Próxima</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QaChecklist;
