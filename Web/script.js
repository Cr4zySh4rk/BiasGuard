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
    const ageMin = document.getElementById('ageMin');
    const ageMax = document.getElementById('ageMax');
    
    // Chart instances
    let ageChart, genderChart, religionChart, locationChart;
    
    // Data storage
    let csvData = [];
    let sensitiveParams = {
        age: { name: 'Age', data: {}, chart: null },
        gender: { name: 'Gender', data: {}, chart: null },
        religion: { name: 'Religion', data: {}, chart: null },
        location: { name: 'Location', data: {}, chart: null }
    };
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
        matchScore: 0
    };

    // Event Listeners
    csvFileInput.addEventListener('change', handleFileSelect);
    analyzeBtn.addEventListener('click', analyzeData);
    generateReportBtn.addEventListener('click', generatePDFReport);
    
    // Set up radio button listeners
    document.querySelectorAll('input[name="gender"]').forEach(radio => {
        radio.addEventListener('change', function() {
            targetingInfo.gender = this.value;
        });
    });
    
    // Set up age range listeners
    ageMin.addEventListener('change', function() {
        targetingInfo.ageMin = parseInt(this.value) || 0;
    });
    
    ageMax.addEventListener('change', function() {
        targetingInfo.ageMax = parseInt(this.value) || 100;
    });

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            fileNameSpan.textContent = file.name;
            analyzeBtn.disabled = false;
        } else {
            fileNameSpan.textContent = 'No file chosen';
            analyzeBtn.disabled = true;
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
            
            // Update targeting info from inputs
            targetingInfo.ageMin = parseInt(ageMin.value) || 0;
            targetingInfo.ageMax = parseInt(ageMax.value) || 100;
            
            analyzeDataMatch();
            createCharts();
            generateInsights();
            
            loadingSection.classList.add('hidden');
            dataSection.classList.remove('hidden');
        } catch (error) {
            console.error('Error analyzing data:', error);
            loadingSection.classList.add('hidden');
            alert('Error analyzing data. Please check the file format and try again.');
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
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
                return obj;
            }, {});
        });
    }
    
    function analyzeDataMatch() {
        analysisResults = {
            totalRecords: csvData.length,
            matchedRecords: 0,
            genderMatch: 0,
            ageMatch: 0,
            matchScore: 0
        };
        
        let genderMatchCount = 0;
        let ageMatchCount = 0;
        let bothMatchCount = 0;
        
        // Reset sensitive params data
        Object.keys(sensitiveParams).forEach(key => {
            sensitiveParams[key].data = {};
        });
        
        csvData.forEach(record => {
            // Check gender match
            const gender = record.gender ? record.gender.toLowerCase() : '';
            const genderMatch = targetingInfo.gender === 'both' || 
                              gender === targetingInfo.gender;
            
            // Check age match
            const age = parseInt(record.age) || 0;
            const ageMatch = age >= targetingInfo.ageMin && age <= targetingInfo.ageMax;
            
            if (genderMatch) genderMatchCount++;
            if (ageMatch) ageMatchCount++;
            if (genderMatch && ageMatch) bothMatchCount++;
            
            // Collect data for visualizations
            if (record.age) {
                const ageGroup = Math.floor(age / 10) * 10;
                const ageRange = `${ageGroup}-${ageGroup + 9}`;
                sensitiveParams.age.data[ageRange] = (sensitiveParams.age.data[ageRange] || 0) + 1;
            }
            
            if (record.gender) {
                const gender = record.gender.toLowerCase();
                sensitiveParams.gender.data[gender] = (sensitiveParams.gender.data[gender] || 0) + 1;
            }
            
            if (record.religion) {
                const religion = record.religion.toLowerCase();
                sensitiveParams.religion.data[religion] = (sensitiveParams.religion.data[religion] || 0) + 1;
            }
            
            if (record.location) {
                const location = record.location.toLowerCase();
                sensitiveParams.location.data[location] = (sensitiveParams.location.data[location] || 0) + 1;
            }
        });
        
        // Calculate match percentages
        analysisResults.genderMatch = (genderMatchCount / analysisResults.totalRecords) * 100;
        analysisResults.ageMatch = (ageMatchCount / analysisResults.totalRecords) * 100;
        analysisResults.matchedRecords = bothMatchCount;
        
        // Calculate overall match score (weighted average)
        analysisResults.matchScore = Math.round(
            (analysisResults.genderMatch * 0.4) + 
            (analysisResults.ageMatch * 0.6)
        );
        
        // Update UI
        updateMatchScoreDisplay();
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
        if (ageChart) ageChart.destroy();
        if (genderChart) genderChart.destroy();
        if (religionChart) religionChart.destroy();
        if (locationChart) locationChart.destroy();
        
        // Age Chart
        const ageCtx = document.getElementById('ageChart').getContext('2d');
        ageChart = new Chart(ageCtx, createBarChartConfig(
            'Age Distribution', 
            Object.keys(sensitiveParams.age.data), 
            Object.values(sensitiveParams.age.data),
            'rgba(54, 162, 235, 0.7)'
        ));
        
        // Gender Chart
        const genderCtx = document.getElementById('genderChart').getContext('2d');
        genderChart = new Chart(genderCtx, createPieChartConfig(
            'Gender Distribution', 
            Object.keys(sensitiveParams.gender.data), 
            Object.values(sensitiveParams.gender.data)
        ));
        
        // Religion Chart
        const religionCtx = document.getElementById('religionChart').getContext('2d');
        religionChart = new Chart(religionCtx, createPieChartConfig(
            'Religion Distribution', 
            Object.keys(sensitiveParams.religion.data), 
            Object.values(sensitiveParams.religion.data)
        ));
        
        // Location Chart
        const locationCtx = document.getElementById('locationChart').getContext('2d');
        locationChart = new Chart(locationCtx, createBarChartConfig(
            'Top Locations', 
            getTopItems(sensitiveParams.location.data, 5).labels,
            getTopItems(sensitiveParams.location.data, 5).values,
            'rgba(75, 192, 192, 0.7)'
        ));
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
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
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
        
        // Gender match insight
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
        
        // Age match insight
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
            const charts = [
                { id: 'ageChart', yPos: 700, width: 300 },
                { id: 'genderChart', yPos: 400, width: 300 },
                { id: 'religionChart', yPos: 100, width: 300 }
            ];
            
            for (const chart of charts) {
                const canvas = document.getElementById(chart.id);
                if (canvas) {
                    const imageData = await html2canvas(canvas);
                    const pngImage = await pdfDoc.embedPng(imageData.toDataURL());
                    const pngDims = pngImage.scale(chart.width / imageData.width);
                    
                    page.drawImage(pngImage, {
                        x: 400,
                        y: chart.yPos,
                        width: pngDims.width,
                        height: pngDims.height,
                    });
                }
            }
            
            // Add location chart on a new page if needed
            const locationCanvas = document.getElementById('locationChart');
            if (locationCanvas) {
                const locationImageData = await html2canvas(locationCanvas);
                const locationPngImage = await pdfDoc.embedPng(locationImageData.toDataURL());
                const locationPngDims = locationPngImage.scale(300 / locationImageData.width);
                
                if (yPos < 300) {
                    page = pdfDoc.addPage([800, 1200]);
                    yPos = 1150;
                }
                
                page.drawImage(locationPngImage, {
                    x: 50,
                    y: yPos - 300,
                    width: locationPngDims.width,
                    height: locationPngDims.height,
                });
                
                page.drawText('Top Locations:', {
                    x: 50,
                    y: yPos - 280,
                    size: 14,
                    font: fontBold,
                    color: rgb(0, 0, 0)
                });
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