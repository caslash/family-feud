//
//  ViewStateService.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/6/23.
//

import Foundation

class ViewStateService: ObservableObject {
    public static var shared = ViewStateService()
    
    @Published public var addFamilyPanelEnabled: Bool
    
    @Published public var loadQuestionsPanelEnabled: Bool
    
    @Published public var playControlPanelEnabled: Bool
    
    @Published public var familiesPanelEnabled: Bool
    
    @Published public var questionSelectorPanelEnabled: Bool
    
    @Published public var questionControlPanelEnabled: Bool
    
    @Published public var newGameEnabled: Bool
    
    @Published public var manageFamiliesEnabled: Bool
    
    @Published public var loadQuestionEnabled: Bool
    
    @Published public var initializeGameEnabled: Bool
    
    @Published public var playGameEnabled: Bool
    
    @Published public var endGameEnabled: Bool
    
    @Published public var fastMoneyEnabled: Bool
    
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
        
        NotificationCenter.default.addObserver(self, selector: #selector(self.startGame), name: .DDGameStarted, object: nil)
    }
    
    @objc
    private func startGame(notification: Notification) {
        self.manageFamiliesEnabled = true
        self.loadQuestionEnabled = true
        self.initializeGameEnabled = true
        self.newGameEnabled = false
        self.fastMoneyEnabled = false
        self.addFamilyPanelEnabled = false
        self.familiesPanelEnabled = false
    }
}
