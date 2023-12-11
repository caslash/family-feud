//
//  ViewStateService.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/6/23.
//

import Foundation
import Observation

@Observable
class ViewStateService {
    var addFamilyPanelEnabled: Bool
    
    var loadQuestionsPanelEnabled: Bool
    
    var playControlPanelEnabled: Bool
    
    var familiesPanelEnabled: Bool
    
    var questionSelectorPanelEnabled: Bool
    
    var questionControlPanelEnabled: Bool
    
    var newGameEnabled: Bool
    
    var manageFamiliesEnabled: Bool
    
    var loadQuestionEnabled: Bool
    
    var initializeGameEnabled: Bool
    
    var playGameEnabled: Bool
    
    var endGameEnabled: Bool
    
    var fastMoneyEnabled: Bool
    
    init() {
        self.addFamilyPanelEnabled = false
        
        self.loadQuestionsPanelEnabled = false
        
        self.playControlPanelEnabled = false
        
        self.familiesPanelEnabled = false
        
        self.questionSelectorPanelEnabled = false
        
        self.questionControlPanelEnabled = false
        
        self.newGameEnabled = false
        
        self.manageFamiliesEnabled = false
        
        self.loadQuestionEnabled = false
        
        self.initializeGameEnabled = false
        
        self.playGameEnabled = false
        
        self.endGameEnabled = false
        
        self.fastMoneyEnabled = false
    }
}
