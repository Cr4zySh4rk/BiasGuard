document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const csvFileInput = document.getElementById('csvFile');
    const fileNameSpan = document.getElementById('fileName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const dataSection = document.querySelector('.data-section');
    const loadingSection = document.querySelector('.loading-section');
    const insightsContent = document.getElementById('insightsContent');
    const overallMatchScore = document.getElementById('overallMatchScore');
    const scoreDescription = document.getElementById('scoreDescription');
    const targetingSection = document.getElementById('targetingSection');
    const ageMin = document.getElementById('ageMin');
    const ageMax = document.getElementById('ageMax');
    const chartsContainer = document.getElementById('chartsContainer');
    
    // Chart instances
    let charts = {};
    
    // Data storage
    let csvData = [];
    let sensitiveParams = {};
    let targetingInfo = {
        gender: 'both',
        ageMin: 18,
        ageMax: 65
    };
    let analysisResults = {
        totalRecords: 0,
        matchedRecords: 0,
        genderMatch: 0,
        ageMatch: 0,
        matchScore: 0,
        parameterStats: {}
    };

    // Common parameter name mappings
    const parameterMappings = {
        age: ['age', 'years', 'yrs', 'year'],
        gender: ['gender', 'sex', 'male/female', 'm/f'],
        location: ['location', 'city', 'state', 'country', 'region', 'address'],
        religion: ['religion', 'faith', 'belief', 'denomination'],
        race: ['race', 'ethnicity', 'ethnic'],
        disability: ['disability', 'disabled', 'handicap'],
        occupation: ['occupation', 'job', 'profession', 'work'],
        income: ['income', 'salary', 'wage', 'earnings'],
        education: ['education', 'degree', 'qualification'],
        marital: ['marital', 'maritalstatus', 'relationshipstatus']
    };

    // Initialize targeting info from inputs
    function updateTargetingInfoFromInputs() {
    const genderRadio = document.querySelector('input[name="gender"]:checked');
    targetingInfo.gender = genderRadio ? genderRadio.value : 'both';
    targetingInfo.ageMin = parseInt(ageMin.value) || 18;
    targetingInfo.ageMax = parseInt(ageMax.value) || 65;
}

    // Event Listeners
csvFileInput.addEventListener('change', handleFileSelect);
analyzeBtn.addEventListener('click', function() {
    updateTargetingInfoFromInputs(); // Update targeting info before analysis
    analyzeData();
});

    // Set up radio button listeners
    document.querySelectorAll('input[name="gender"]').forEach(radio => {
        radio.addEventListener('change', function() {
            targetingInfo.gender = this.value;
            updateAnalysis();
        });
    });
    
    // Set up age range listeners
    ageMin.addEventListener('change', function() {
        targetingInfo.ageMin = parseInt(this.value) || 18;
        updateAnalysis();
    });
    
    ageMax.addEventListener('change', function() {
        targetingInfo.ageMax = parseInt(this.value) || 65;
        updateAnalysis();
    });

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            fileNameSpan.textContent = file.name;
            analyzeBtn.disabled = false;
            targetingSection.classList.remove('hidden');
        } else {
            fileNameSpan.textContent = 'No file chosen';
            analyzeBtn.disabled = true;
        }
    }
    
    function updateAnalysis() {
        if (csvData.length > 0) {
            analyzeDataMatch();
            updateMatchScoreDisplay();
            generateInsights();
        }
    }
    
    async function analyzeData() {
    const file = csvFileInput.files[0];
    if (!file) return;
    
    loadingSection.classList.remove('hidden');
    dataSection.classList.add('hidden');
    
    try {
        const text = await readFileAsText(file);
        csvData = parseCSV(text);
        
        // Update targeting info from current input values
        updateTargetingInfoFromInputs();
        
        // Reset and detect sensitive parameters
        sensitiveParams = {};
        detectSensitiveParameters();
        
        // Initialize analysis results with proper structure
        analysisResults = {
            totalRecords: csvData.length,
            matchedRecords: 0,
            genderMatch: 0,
            ageMatch: 0,
            matchScore: 0,
            parameterStats: {}
        };
        
        // Process data and calculate statistics
        processDataAndCalculateStats();
        
        // Now calculate the match score
        analyzeDataMatch();
        
        // Update UI
        createCharts();
        generateInsights();
        updateMatchScoreDisplay();
        
        loadingSection.classList.add('hidden');
        dataSection.classList.remove('hidden');
    } catch (error) {
        console.error('Error analyzing data:', error);
        loadingSection.classList.add('hidden');
        alert('Error analyzing data. Please check the file format and try again.');
    }
}

function processDataAndCalculateStats() {
    // Reset parameter stats
    analysisResults.parameterStats = {};
    
    csvData.forEach(record => {
        // Process each detected sensitive parameter
        Object.entries(sensitiveParams).forEach(([paramType, paramInfo]) => {
            const paramName = paramInfo.name;
            const paramValue = record[paramName];
            
            if (paramValue === undefined || paramValue === '') return;
            
            // Initialize stats if not exists
            if (!analysisResults.parameterStats[paramType]) {
                analysisResults.parameterStats[paramType] = {};
            }
            
            // Special handling for age
            if (paramType === 'age') {
                const age = parseInt(paramValue) || 0;
                if (!isNaN(age)) {
                    const ageGroup = Math.floor(age / 10) * 10;
                    const ageRange = `${ageGroup}-${ageGroup + 9}`;
                    sensitiveParams.age.data[ageRange] = (sensitiveParams.age.data[ageRange] || 0) + 1;
                    
                    if (!analysisResults.parameterStats.age.stats) {
                        analysisResults.parameterStats.age.stats = {
                            min: age,
                            max: age,
                            sum: age,
                            count: 1
                        };
                    } else {
                        analysisResults.parameterStats.age.stats.min = Math.min(
                            analysisResults.parameterStats.age.stats.min, age);
                        analysisResults.parameterStats.age.stats.max = Math.max(
                            analysisResults.parameterStats.age.stats.max, age);
                        analysisResults.parameterStats.age.stats.sum += age;
                        analysisResults.parameterStats.age.stats.count++;
                    }
                }
            } 
            // Special handling for gender
            else if (paramType === 'gender') {
                const gender = paramValue.toLowerCase();
                sensitiveParams.gender.data[gender] = (sensitiveParams.gender.data[gender] || 0) + 1;
                analysisResults.parameterStats.gender[gender] = 
                    (analysisResults.parameterStats.gender[gender] || 0) + 1;
            }
            // For all other parameters
            else {
                const value = paramValue.toString().toLowerCase();
                sensitiveParams[paramType].data[value] = 
                    (sensitiveParams[paramType].data[value] || 0) + 1;
                
                analysisResults.parameterStats[paramType][value] = 
                    (analysisResults.parameterStats[paramType][value] || 0) + 1;
            }
        });
    });
    
    // Calculate average age if available
    if (analysisResults.parameterStats.age?.stats) {
        const ageStats = analysisResults.parameterStats.age.stats;
        ageStats.avg = Math.round(ageStats.sum / ageStats.count);
    }
}

function updateTargetingInfoFromInputs() {
    const genderRadio = document.querySelector('input[name="gender"]:checked');
    targetingInfo.gender = genderRadio ? genderRadio.value : 'both';
    targetingInfo.ageMin = parseInt(ageMin.value) || 18;
    targetingInfo.ageMax = parseInt(ageMax.value) || 65;
}
    
    function detectSensitiveParameters() {
        sensitiveParams = {};
        
        if (csvData.length === 0) return;
        
        const firstRecord = csvData[0];
        const headers = Object.keys(firstRecord);
        
        // Detect each parameter type based on common name patterns
        for (const [paramType, patterns] of Object.entries(parameterMappings)) {
            for (const header of headers) {
                const headerLower = header.toLowerCase();
                if (patterns.some(pattern => headerLower.includes(pattern))) {
                    if (!sensitiveParams[paramType]) {
                        sensitiveParams[paramType] = {
                            name: header,
                            data: {}
                        };
                    }
                    break;
                }
            }
        }
        
        // For any remaining headers, add them as generic parameters
        headers.forEach(header => {
            const headerLower = header.toLowerCase();
            const isMapped = Object.values(parameterMappings).some(patterns => 
                patterns.some(pattern => headerLower.includes(pattern)));
            
            if (!isMapped) {
                sensitiveParams[header] = {
                    name: header,
                    data: {}
                };
            }
        });
    }
    
    function collectParameterStatistics() {
        analysisResults.parameterStats = {};
        
        csvData.forEach(record => {
            // Process each detected sensitive parameter
            Object.entries(sensitiveParams).forEach(([paramType, paramInfo]) => {
                const paramName = paramInfo.name;
                const paramValue = record[paramName];
                
                if (paramValue === undefined || paramValue === '') return;
                
                // Initialize stats if not exists
                if (!analysisResults.parameterStats[paramType]) {
                    analysisResults.parameterStats[paramType] = {};
                }
                
                // Special handling for age
                if (paramType === 'age') {
                    const age = parseInt(paramValue) || 0;
                    if (!isNaN(age)) {
                        const ageGroup = Math.floor(age / 10) * 10;
                        const ageRange = `${ageGroup}-${ageGroup + 9}`;
                        sensitiveParams.age.data[ageRange] = (sensitiveParams.age.data[ageRange] || 0) + 1;
                        
                        if (!analysisResults.parameterStats.age.stats) {
                            analysisResults.parameterStats.age.stats = {
                                min: age,
                                max: age,
                                sum: age,
                                count: 1
                            };
                        } else {
                            analysisResults.parameterStats.age.stats.min = Math.min(
                                analysisResults.parameterStats.age.stats.min, age);
                            analysisResults.parameterStats.age.stats.max = Math.max(
                                analysisResults.parameterStats.age.stats.max, age);
                            analysisResults.parameterStats.age.stats.sum += age;
                            analysisResults.parameterStats.age.stats.count++;
                        }
                    }
                } 
                // Special handling for gender
                else if (paramType === 'gender') {
                    const gender = paramValue.toLowerCase();
                    sensitiveParams.gender.data[gender] = (sensitiveParams.gender.data[gender] || 0) + 1;
                    analysisResults.parameterStats.gender[gender] = 
                        (analysisResults.parameterStats.gender[gender] || 0) + 1;
                }
                // For all other parameters
                else {
                    const value = paramValue.toString().toLowerCase();
                    sensitiveParams[paramType].data[value] = 
                        (sensitiveParams[paramType].data[value] || 0) + 1;
                    
                    analysisResults.parameterStats[paramType][value] = 
                        (analysisResults.parameterStats[paramType][value] || 0) + 1;
                }
            });
        });
        
        // Calculate average age if available
        if (analysisResults.parameterStats.age?.stats) {
            const ageStats = analysisResults.parameterStats.age.stats;
            ageStats.avg = Math.round(ageStats.sum / ageStats.count);
        }
    }
    
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file);
        });
    }
    
    function parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
                return obj;
            }, {});
        });
    }
    
    function analyzeDataMatch() {
        analysisResults.totalRecords = csvData.length;
        let genderMatchCount = 0;
        let ageMatchCount = 0;
        let bothMatchCount = 0;
        
        csvData.forEach(record => {
            // Check gender match if gender parameter exists
            let genderMatch = true;
            if (sensitiveParams.gender) {
                const gender = record[sensitiveParams.gender.name] ? 
                    record[sensitiveParams.gender.name].toLowerCase() : '';
                genderMatch = targetingInfo.gender === 'both' || 
                            gender === targetingInfo.gender;
            }
            
            // Check age match if age parameter exists
            let ageMatch = true;
            if (sensitiveParams.age) {
                const age = parseInt(record[sensitiveParams.age.name]) || 0;
                ageMatch = age >= targetingInfo.ageMin && age <= targetingInfo.ageMax;
            }
            
            if (genderMatch) genderMatchCount++;
            if (ageMatch) ageMatchCount++;
            if (genderMatch && ageMatch) bothMatchCount++;
        });
        
        // Calculate match percentages
        analysisResults.genderMatch = analysisResults.totalRecords > 0 
            ? (genderMatchCount / analysisResults.totalRecords) * 100 
            : 0;
        analysisResults.ageMatch = analysisResults.totalRecords > 0 
            ? (ageMatchCount / analysisResults.totalRecords) * 100 
            : 0;
        analysisResults.matchedRecords = bothMatchCount;
        
        // Calculate overall match score (weighted average)
        analysisResults.matchScore = Math.round(
            (analysisResults.genderMatch * 0.4) + 
            (analysisResults.ageMatch * 0.6)
        );
    }
    
    function updateMatchScoreDisplay() {
        overallMatchScore.textContent = `${analysisResults.matchScore}%`;
        
        // Set color based on score
        if (analysisResults.matchScore >= 80) {
            overallMatchScore.style.color = 'var(--secondary-color)';
            scoreDescription.textContent = 'Excellent match! The dataset aligns very well with your target audience.';
        } else if (analysisResults.matchScore >= 50) {
            overallMatchScore.style.color = 'var(--warning-color)';
            scoreDescription.textContent = 'Moderate match. Consider adjusting your targeting or finding a more suitable dataset.';
        } else {
            overallMatchScore.style.color = 'var(--danger-color)';
            scoreDescription.textContent = 'Poor match. This dataset does not align well with your target audience.';
        }
    }
    
    function createCharts() {
        // Clear existing charts
        Object.values(charts).forEach(chart => chart.destroy());
        charts = {};
        
        // Clear existing chart cards (except the first three)
        const chartCards = chartsContainer.querySelectorAll('.chart-card');
        for (let i = 3; i < chartCards.length; i++) {
            chartCards[i].remove();
        }
        
        // Create charts for detected parameters (max 6 to avoid clutter)
        const paramsToChart = Object.keys(sensitiveParams).slice(0, 6);
        
        paramsToChart.forEach((paramType, index) => {
            const paramInfo = sensitiveParams[paramType];
            const paramData = paramInfo.data;
            
            // Skip if no data
            if (Object.keys(paramData).length === 0) return;
            
            // Get or create chart container
            let chartCard, canvas;
            if (index < 3) {
                // Reuse existing chart cards for first three parameters
                chartCard = chartCards[index];
                canvas = chartCard.querySelector('canvas');
                canvas.id = `${paramType}Chart`;
            } else {
                // Create new chart card for additional parameters
                chartCard = document.createElement('div');
                chartCard.className = 'chart-card';
                canvas = document.createElement('canvas');
                canvas.id = `${paramType}Chart`;
                chartCard.appendChild(canvas);
                chartsContainer.appendChild(chartCard);
            }
            
            // Create appropriate chart based on parameter type
            const ctx = canvas.getContext('2d');
            
            if (paramType === 'age') {
                charts[paramType] = new Chart(ctx, createBarChartConfig(
                    'Age Distribution', 
                    Object.keys(paramData), 
                    Object.values(paramData),
                    'rgba(54, 162, 235, 0.7)'
                ));
            } else if (paramType === 'gender') {
                charts[paramType] = new Chart(ctx, createPieChartConfig(
                    'Gender Distribution', 
                    Object.keys(paramData), 
                    Object.values(paramData)
                ));
            } else {
                const topItems = getTopItems(paramData, 5);
                charts[paramType] = new Chart(ctx, createBarChartConfig(
                    paramInfo.name,
                    topItems.labels,
                    topItems.values,
                    getColorForIndex(index)
                ));
            }
        });
    }
    
    function getColorForIndex(index) {
        const colors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
        ];
        return colors[index % colors.length];
    }
    
    function getTopItems(data, count) {
        const items = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, count);
        return {
            labels: items.map(item => item[0]),
            values: items.map(item => item[1])
        };
    }
    
    function createBarChartConfig(title, labels, data, backgroundColor) {
        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: backgroundColor.replace('0.7', '1'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 16
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        };
    }
    
    function createPieChartConfig(title, labels, data) {
        const backgroundColors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
        ];
        
        return {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 16
                        }
                    }
                }
            }
        };
    }
    
    function generateInsights() {
        insightsContent.innerHTML = '';
        
        // Main match insight
        addInsight(
            analysisResults.matchScore >= 80 ? 'positive' : 
            analysisResults.matchScore >= 50 ? 'warning' : 'negative',
            'Target Audience Match',
            `${analysisResults.matchedRecords} of ${analysisResults.totalRecords} records (${Math.round((analysisResults.matchedRecords / analysisResults.totalRecords) * 100)}%) match both your gender and age criteria`,
            analysisResults.matchScore >= 80 ? 
                'Excellent alignment with your target audience' : 
                analysisResults.matchScore >= 50 ?
                'Moderate alignment - some adjustments may be needed' :
                'Poor alignment - consider different targeting parameters or dataset'
        );
        
        // Gender match insight if gender parameter exists
        if (sensitiveParams.gender) {
            addInsight(
                analysisResults.genderMatch >= 80 ? 'positive' : 
                analysisResults.genderMatch >= 50 ? 'warning' : 'negative',
                'Gender Match',
                `${Math.round(analysisResults.genderMatch)}% match with your gender target`,
                targetingInfo.gender === 'both' ? 
                    'You are targeting both genders' :
                    analysisResults.genderMatch >= 80 ?
                    'Strong gender match' :
                    analysisResults.genderMatch >= 50 ?
                    'Moderate gender match' :
                    'Weak gender match'
            );
        }
        
        // Age match insight if age parameter exists
        if (sensitiveParams.age) {
            addInsight(
                analysisResults.ageMatch >= 80 ? 'positive' : 
                analysisResults.ageMatch >= 50 ? 'warning' : 'negative',
                'Age Range Match',
                `${Math.round(analysisResults.ageMatch)}% match with your age range (${targetingInfo.ageMin}-${targetingInfo.ageMax})`,
                analysisResults.ageMatch >= 80 ?
                    'Strong age range match' :
                    analysisResults.ageMatch >= 50 ?
                    'Moderate age range match' :
                    'Weak age range match'
            );
        }
        
        // Add insights for each detected parameter
        Object.entries(sensitiveParams).forEach(([paramType, paramInfo]) => {
            const stats = analysisResults.parameterStats[paramType];
            if (!stats) return;
            
            if (paramType === 'age' && stats.stats) {
                const ageStats = stats.stats;
                addInsight(
                    'neutral',
                    'Age Statistics',
                    `Average age: ${ageStats.avg}, Range: ${ageStats.min}-${ageStats.max}`,
                    `The dataset contains ages from ${ageStats.min} to ${ageStats.max} with an average of ${ageStats.avg} years`
                );
            } 
            else if (paramType === 'gender') {
                const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
                const distribution = Object.entries(stats)
                    .map(([gender, count]) => `${gender} (${Math.round((count/total)*100)}%)`)
                    .join(', ');
                
                addInsight(
                    'neutral',
                    'Gender Distribution',
                    distribution,
                    'Breakdown of gender representation in the dataset'
                );
            }
            else {
                // For other parameters, show top values
                const topValues = Object.entries(stats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([value, count]) => `${value} (${count})`)
                    .join(', ');
                
                addInsight(
                    'neutral',
                    paramInfo.name,
                    topValues,
                    `Top values for ${paramInfo.name} in the dataset`
                );
            }
        });
        
        // Recommendation insight
        let recommendation = '';
        if (analysisResults.matchScore >= 80) {
            recommendation = 'This dataset is well-suited for your campaign. Proceed with confidence.';
        } else if (analysisResults.matchScore >= 50) {
            recommendation = 'Consider adjusting your targeting parameters or finding a more suitable dataset.';
        } else {
            recommendation = 'This dataset is not ideal for your campaign. Strongly consider finding alternative data.';
        }
        
        addInsight(
            'neutral',
            'Recommendation',
            recommendation,
            'Based on your targeting criteria and dataset match'
        );
    }
    
    function addInsight(type, title, data, description) {
        const insight = document.createElement('div');
        insight.className = `insight-item insight-${type}`;
        
        insight.innerHTML = `
            <h4>${title}</h4>
            <div class="insight-data">${data}</div>
            <div class="insight-description">${description}</div>
        `;
        
        insightsContent.appendChild(insight);
    }
    
    async function generatePDFReport() {
        try {
            loadingSection.classList.remove('hidden');
            
            // Create a new PDF document
            const { PDFDocument, rgb } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            
            // Add a new page (larger size for charts)
            let page = pdfDoc.addPage([800, 1200]);
            
            // Set up fonts
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            
            // Add title
            page.drawText('Ad Targeting Match Report', {
                x: 50,
                y: 1150,
                size: 24,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            // Add date
            const today = new Date();
            page.drawText(`Generated on: ${today.toLocaleDateString()}`, {
                x: 50,
                y: 1110,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            // Add targeting information
            page.drawText('Your Target Audience:', {
                x: 50,
                y: 1060,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            const genderText = `Gender: ${targetingInfo.gender === 'both' ? 'Male & Female' : targetingInfo.gender}`;
            const ageText = `Age Range: ${targetingInfo.ageMin}-${targetingInfo.ageMax}`;
            
            page.drawText(genderText, {
                x: 50,
                y: 1030,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            page.drawText(ageText, {
                x: 50,
                y: 1010,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            // Add match score
            const scoreColor = analysisResults.matchScore >= 80 ? rgb(0, 0.5, 0) :
                             analysisResults.matchScore >= 50 ? rgb(0.8, 0.5, 0) :
                             rgb(0.8, 0, 0);
            
            page.drawText('Overall Match Score:', {
                x: 50,
                y: 970,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            page.drawText(`${analysisResults.matchScore}%`, {
                x: 50,
                y: 940,
                size: 36,
                font: fontBold,
                color: scoreColor
            });
            
            // Add match description
            let matchDesc = '';
            if (analysisResults.matchScore >= 80) {
                matchDesc = 'Excellent match! The dataset aligns very well with your target audience.';
            } else if (analysisResults.matchScore >= 50) {
                matchDesc = 'Moderate match. Consider adjusting your targeting or finding a more suitable dataset.';
            } else {
                matchDesc = 'Poor match. This dataset does not align well with your target audience.';
            }
            
            page.drawText(matchDesc, {
                x: 50,
                y: 900,
                size: 12,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            // Add insights section
            page.drawText('Detailed Insights:', {
                x: 50,
                y: 860,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            
            const insights = document.querySelectorAll('.insight-item');
            let yPos = 830;
            
            insights.forEach((insight, index) => {
                if (yPos < 100) {
                    // Add new page if we run out of space
                    page = pdfDoc.addPage([800, 1200]);
                    yPos = 1150;
                    page.drawText('Detailed Insights (continued):', {
                        x: 50,
                        y: 1150,
                        size: 16,
                        font: fontBold,
                        color: rgb(0, 0, 0)
                    });
                    yPos = 1120;
                }
                
                const title = insight.querySelector('h4').textContent;
                const data = insight.querySelector('.insight-data').textContent;
                const desc = insight.querySelector('.insight-description').textContent;
                
                // Determine color based on insight type
                let color = rgb(0, 0, 0);
                if (insight.classList.contains('insight-positive')) {
                    color = rgb(0, 0.5, 0);
                } else if (insight.classList.contains('insight-negative')) {
                    color = rgb(0.8, 0, 0);
                } else if (insight.classList.contains('insight-warning')) {
                    color = rgb(0.8, 0.5, 0);
                }
                
                page.drawText(title, {
                    x: 50,
                    y: yPos,
                    size: 14,
                    font: fontBold,
                    color: color
                });
                
                page.drawText(data, {
                    x: 50,
                    y: yPos - 20,
                    size: 12,
                    font: font,
                    color: color
                });
                
                page.drawText(desc, {
                    x: 50,
                    y: yPos - 40,
                    size: 10,
                    font: font,
                    color: rgb(0.3, 0.3, 0.3)
                });
                
                yPos -= 70;
            });
            
            // Convert charts to images and embed in PDF
            const chartElements = document.querySelectorAll('.chart-card canvas');
            let chartYPos = 700;
            
            for (const chartElement of chartElements) {
                if (chartYPos < 100) {
                    // Add new page if we run out of space
                    page = pdfDoc.addPage([800, 1200]);
                    chartYPos = 1150;
                }
                
                const imageData = await html2canvas(chartElement);
                const pngImage = await pdfDoc.embedPng(imageData.toDataURL());
                const pngDims = pngImage.scale(300 / imageData.width);
                
                page.drawImage(pngImage, {
                    x: 400,
                    y: chartYPos,
                    width: pngDims.width,
                    height: pngDims.height,
                });
                
                chartYPos -= 350;
            }
            
            // Save the PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            saveAs(blob, 'Targeting_Match_Report.pdf');
            
            loadingSection.classList.add('hidden');
        } catch (error) {
            console.error('Error generating PDF:', error);
            loadingSection.classList.add('hidden');
            alert('Error generating PDF report. Please try again.');
        }
    }
});