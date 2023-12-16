//
//  StateControlViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/4/23.
//

import FeudKit
import Foundation
import SwiftUI

class StateControlViewModel: ObservableObject {
    @ObservedObject public var matchmanager: MatchManager
    @ObservedObject public var windowcontroller: ManagementWindowController
    @ObservedObject public var viewstateservice: ViewStateService
    
    init(matchmanager: MatchManager, windowcontroller: ManagementWindowController, viewstateservice: ViewStateService) {
        self.matchmanager = matchmanager
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
    }
    
    func startGame() {
        self.matchmanager.startMatchmaking()
    }
    
    func manageFamilies() {
        if let game = self.matchmanager.game {
            if (game.changeState(type: FFStateType.ADD_FAMILY)) {
                self.viewstateservice.addFamilyPanelEnabled = true
                self.viewstateservice.loadQuestionsPanelEnabled = false
            }
        }
    }
    
    func loadQuestions() {
        if let game = self.matchmanager.game {
            _ = game.changeState(type: FFStateType.LOAD_QUESTIONS)
            self.viewstateservice.addFamilyPanelEnabled = false
            self.viewstateservice.loadQuestionsPanelEnabled = true
        }
    }
    
    func initializeGame() {
        if let game = self.matchmanager.game {
            if (game.changeState(type: FFStateType.INITIALIZE_GAME)) {
                self.viewstateservice.initializeGameEnabled = false
                self.viewstateservice.newGameEnabled = false
                self.viewstateservice.manageFamiliesEnabled = false
                self.viewstateservice.loadQuestionEnabled = false
                self.viewstateservice.addFamilyPanelEnabled = false
                self.viewstateservice.loadQuestionsPanelEnabled = false
                self.viewstateservice.playGameEnabled = true
            }
        }
    }
    
    func playGame() {
        if let game = self.matchmanager.game {
            if (game.changeState(type: FFStateType.PLAY)) {
                self.viewstateservice.playGameEnabled = false
                self.viewstateservice.initializeGameEnabled = false
                self.viewstateservice.fastMoneyEnabled = true
                self.viewstateservice.endGameEnabled = true
                self.viewstateservice.questionSelectorPanelEnabled = true
                self.viewstateservice.playControlPanelEnabled = true
            }
        }
    }
    
    func endGame() {
        if let game = self.matchmanager.game {
            //TODO: End Game Confirmation
            if (game.changeState(type: FFStateType.END_GAME)) {
                self.viewstateservice.playGameEnabled = false
                self.viewstateservice.endGameEnabled = false
                self.viewstateservice.newGameEnabled = true
                self.viewstateservice.fastMoneyEnabled = true
                self.viewstateservice.questionSelectorPanelEnabled = false
                self.viewstateservice.playControlPanelEnabled = false
                self.viewstateservice.questionControlPanelEnabled = false
            }
        }
        
        self.matchmanager.gameOver()
    }
    
    func startFastMoney() {
        if let game = self.matchmanager.game {
            if (game.changeState(type: FFStateType.FAST_MONEY)) {
                self.viewstateservice.fastMoneyEnabled = false
                self.viewstateservice.questionSelectorPanelEnabled = false
                self.viewstateservice.questionControlPanelEnabled = false
                if (!game.finished()) { self.viewstateservice.playGameEnabled = true }
                self.viewstateservice.endGameEnabled = true
            }
        }
    }
}
