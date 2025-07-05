document.addEventListener('DOMContentLoaded', function() {
    // Tab Navigation
    const tabLinks = document.querySelectorAll('.dashboard-nav li');
    tabLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Remove active class from all tabs and links
            tabLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Add active class to clicked tab
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Content Analysis Tab Navigation
    const contentTabBtns = document.querySelectorAll('.results-tabs .tab-btn');
    contentTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons and tabs
            contentTabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.results-tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Add active class to clicked button and tab
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Content Type Toggle
    const contentTypeRadios = document.querySelectorAll('input[name="contentType"]');
    const textInputSection = document.getElementById('textInputSection');
    const imageInputSection = document.getElementById('imageInputSection');
    
    contentTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'text') {
                textInputSection.classList.remove('hidden');
                imageInputSection.classList.add('hidden');
            } else {
                textInputSection.classList.add('hidden');
                imageInputSection.classList.remove('hidden');
            }
        });
    });

    // Image Preview
    const contentImageInput = document.getElementById('contentImage');
    const imagePreview = document.getElementById('imagePreview');
    
    contentImageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                imagePreview.classList.remove('hidden');
            }
            reader.readAsDataURL(file);
        } else {
            imagePreview.classList.add('hidden');
        }
    });

    // Analyze Content Button
    const analyzeContentBtn = document.getElementById('analyzeContentBtn');
    const contentResults = document.getElementById('contentResults');
    const contentLoading = document.getElementById('contentLoading');
    
    analyzeContentBtn.addEventListener('click', function() {
        const contentType = document.querySelector('input[name="contentType"]:checked').value;
        
        if (contentType === 'text') {
            const text = document.getElementById('contentText').value.trim();
            if (!text) {
                alert('Please enter some text to analyze');
                return;
            }
            analyzeTextContent(text);
        } else {
            const file = contentImageInput.files[0];
            if (!file) {
                alert('Please select an image to analyze');
                return;
            }
            analyzeImageContent(file);
        }
    });

    function analyzeTextContent(text) {
        contentLoading.classList.remove('hidden');
        contentResults.classList.add('hidden');
        
        // Simulate API call with timeout
        setTimeout(() => {
            // This is where you would call your actual Python backend
            // For now, we'll simulate the response
            const biasResults = simulateTextBiasAnalysis(text);
            const piiResults = simulatePIIAnalysis(text);
            const harmfulResults = simulateHarmfulContentAnalysis(text);
            
            displayContentResults(biasResults, piiResults, harmfulResults);
            
            contentLoading.classList.add('hidden');
            contentResults.classList.remove('hidden');
        }, 1500);
    }

    function analyzeImageContent(file) {
        contentLoading.classList.remove('hidden');
        contentResults.classList.add('hidden');
        
        // Simulate API call with timeout
        setTimeout(() => {
            // This is where you would call your actual Python backend
            // For now, we'll simulate the response
            const reader = new FileReader();
            reader.onload = function(e) {
                const biasResults = simulateImageBiasAnalysis();
                const piiResults = simulatePIIAnalysis("Sample extracted text from image");
                const harmfulResults = simulateHarmfulContentAnalysis("Sample extracted text from image");
                
                displayContentResults(biasResults, piiResults, harmfulResults);
                
                contentLoading.classList.add('hidden');
                contentResults.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }, 2000);
    }

    function displayContentResults(biasResults, piiResults, harmfulResults) {
        // Update overall score
        const overallScore = document.getElementById('overallBiasScore');
        const scoreDescription = document.getElementById('biasScoreDescription');
        
        overallScore.textContent = `${biasResults.bias_score}/10`;
        
        if (biasResults.bias_score >= 7) {
            overallScore.style.color = 'var(--danger-color)';
            scoreDescription.textContent = 'High bias risk detected. Strongly recommend reviewing this content.';
        } else if (biasResults.bias_score >= 4) {
            overallScore.style.color = 'var(--warning-color)';
            scoreDescription.textContent = 'Moderate bias risk detected. Consider reviewing this content.';
        } else {
            overallScore.style.color = 'var(--secondary-color)';
            scoreDescription.textContent = 'Low bias risk detected. Content appears acceptable.';
        }
        
        // Update bias categories
        const biasCategoriesContainer = document.getElementById('biasCategories');
        biasCategoriesContainer.innerHTML = '';
        
        for (const [category, flags] of Object.entries(biasResults.bias_categories)) {
            if (flags.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'bias-category';
                
                const categoryTitle = document.createElement('h3');
                categoryTitle.textContent = category.replace('_', ' ').toUpperCase();
                
                const flagsList = document.createElement('div');
                
                flags.forEach(flag => {
                    const flagItem = document.createElement('div');
                    flagItem.className = 'bias-item ' + 
                        (biasResults.bias_score >= 7 ? 'danger' : 
                         biasResults.bias_score >= 4 ? 'warning' : '');
                    flagItem.textContent = flag;
                    flagsList.appendChild(flagItem);
                });
                
                categoryDiv.appendChild(categoryTitle);
                categoryDiv.appendChild(flagsList);
                biasCategoriesContainer.appendChild(categoryDiv);
            }
        }
        
        // Update security findings
        const securityFindingsContainer = document.getElementById('securityFindings');
        securityFindingsContainer.innerHTML = '';
        
        // PII Findings
        const piiFinding = document.createElement('div');
        piiFinding.className = 'finding ' + (piiResults.has_pii ? '' : 'none');
        
        const piiTitle = document.createElement('h4');
        piiTitle.textContent = 'Personal Identifiable Information (PII)';
        
        const piiContent = document.createElement('div');
        if (piiResults.has_pii) {
            const piiList = document.createElement('ul');
            piiResults.detected_items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                piiList.appendChild(li);
            });
            piiContent.appendChild(piiList);
        } else {
            piiContent.textContent = 'No PII detected';
        }
        
        piiFinding.appendChild(piiTitle);
        piiFinding.appendChild(piiContent);
        securityFindingsContainer.appendChild(piiFinding);
        
        // Harmful Content Findings
        const harmfulFinding = document.createElement('div');
        harmfulFinding.className = 'finding ' + (harmfulResults.has_harmful_content ? '' : 'none');
        
        const harmfulTitle = document.createElement('h4');
        harmfulTitle.textContent = 'Harmful Content';
        
        const harmfulContent = document.createElement('div');
        if (harmfulResults.has_harmful_content) {
            const harmfulList = document.createElement('ul');
            harmfulResults.detected_items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                harmfulList.appendChild(li);
            });
            harmfulContent.appendChild(harmfulList);
        } else {
            harmfulContent.textContent = 'No harmful content detected';
        }
        
        harmfulFinding.appendChild(harmfulTitle);
        harmfulFinding.appendChild(harmfulContent);
        securityFindingsContainer.appendChild(harmfulFinding);
    }

    // Simulation functions - these would be replaced with actual API calls to your Python backend
    function simulateTextBiasAnalysis(text) {
        // This simulates the Python bias analysis
        const biasCategories = {
            "gender": [],
            "age": [],
            "stereotypical_role": [],
            "benevolent_sexism": [],
            "racial_socioeconomic": [],
            "ableism": []
        };
        let biasScore = 0;
        
        // Simple simulation based on text content
        const textLower = text.toLowerCase();
        
        // Check for gender bias
        if (textLower.includes('businessman') && !textLower.includes('businesswoman')) {
            biasCategories.gender.push("Male-centric language detected. Consider using gender-neutral terms.");
            biasScore += 1;
        }
        
        // Check for age bias
        if (textLower.includes('retiree') || textLower.includes('senior citizen')) {
            biasCategories.age.push("Content targets older demographic, potentially excluding others.");
            biasScore += 1;
        }
        
        // Check for stereotypical roles
        if (textLower.includes('kitchen') && (textLower.includes('woman') || textLower.includes('female'))) {
            biasCategories.stereotypical_role.push("Potential gender stereotype: linking women to domestic roles.");
            biasScore += 2;
        }
        
        // Check for benevolent sexism
        if (textLower.includes('women') && textLower.includes('safety')) {
            biasCategories.benevolent_sexism.push("Potential benevolent sexism: implying women need special protection.");
            biasScore += 3;
        }
        
        // Check for racial/socioeconomic bias
        if (textLower.includes('struggling') || textLower.includes('poverty')) {
            biasCategories.racial_socioeconomic.push("Potential socioeconomic bias in content.");
            biasScore += 2;
        }
        
        // If no biases detected
        if (biasScore === 0) {
            biasCategories.gender.push("No significant gender bias detected");
            biasCategories.age.push("No significant age bias detected");
        }
        
        return {
            bias_categories: biasCategories,
            bias_score: Math.min(biasScore, 10),
            is_biased: biasScore > 0
        };
    }

    function simulateImageBiasAnalysis() {
        // This simulates the Python image bias analysis
        return {
            bias_categories: {
                "gender": ["Potential gender imbalance in image composition"],
                "racial_socioeconomic": ["Potential racial/socioeconomic stereotype implied by contrasting individuals"],
                "benevolent_sexism": ["Potential benevolent sexism/vulnerability stereotype"]
            },
            bias_score: 6,
            is_biased: true,
            generated_caption: "A group of people including a man in suit and a woman looking at a document"
        };
    }

    function simulatePIIAnalysis(text) {
        // This simulates the Python PII detection
        const hasPII = Math.random() > 0.7; // 30% chance of PII
        if (!hasPII) {
            return {
                has_pii: false,
                detected_items: []
            };
        }
        
        const piiTypes = [
            "Email: user@example.com",
            "Phone: 555-123-4567",
            "Credit Card (potential): 1234-5678-9012-3456"
        ];
        
        return {
            has_pii: true,
            detected_items: [piiTypes[Math.floor(Math.random() * piiTypes.length)]]
        };
    }

    function simulateHarmfulContentAnalysis(text) {
        // This simulates the Python harmful content detection
        const hasHarmful = Math.random() > 0.8; // 20% chance of harmful content
        if (!hasHarmful) {
            return {
                has_harmful_content: false,
                detected_items: []
            };
        }
        
        const harmfulTerms = [
            "hate",
            "violence",
            "exploit",
            "deceive"
        ];
        
        return {
            has_harmful_content: true,
            detected_items: [harmfulTerms[Math.floor(Math.random() * harmfulTerms.length)]]
        };
    }

    // Include all the existing audience analysis code from your script.js here
    // (The entire content of your original script.js should be included)
});