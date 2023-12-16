//
//  QuestionControlViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/10/23.
//

import FeudKit
import Foundation
import SwiftUI

class QuestionControlViewModel: ObservableObject {
    @ObservedObject public var matchmanager: MatchManager
    @ObservedObject public var windowcontroller: ManagementWindowController
    @ObservedObject public var viewstateservice: ViewStateService
    
    public var answers: [Answer] {
        if let game = self.matchmanager.game {
            return game.getQuestionSet().getSelectedQuestion()?.getAnswers() ?? []
        } else {
            return []
        }
    }
    
    public var selectedAnswerId: Answer.ID?
    
    
    init(matchmanager: MatchManager, windowcontroller: ManagementWindowController, viewstateservice: ViewStateService) {
        self.matchmanager = matchmanager
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
    }
    
    public func reveal() {
        if let game = self.matchmanager.game {
            if let selectedAnswerId {
                if let selectedAnswer = game.getQuestionSet().getSelectedQuestion()!.getAnswers().first(where: { $0.id == selectedAnswerId }) {
                    if (!selectedAnswer.isRevealed()) {
                        _ = game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                            StateFamilyPlay.ACTION_OPENANSWER,
                            game.getQuestionSet().getSelectedQuestion()!.getAnswers().firstIndex { $0.id == self.selectedAnswerId! } ?? -1
                        ])
                        self.selectedAnswerId = nil
                    } else {
                        _ = game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                            StateFamilyPlay.ACTION_OPENANSWER,
                            game.getQuestionSet().getSelectedQuestion()?.getAnswers().firstIndex { $0.id == self.selectedAnswerId } ?? -1
                        ])
                    }
                }
            }
        }
    }
    
    public func strike() {
        if let game = self.matchmanager.game {
            _ = game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [StateFamilyPlay.ACTION_STRIKE])
        }
    }
}
