//
//  QuestionControlViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/10/23.
//

import FeudKit
import Foundation
import Observation

@Observable
class QuestionControlViewModel {
    private var game: FamilyFeudGame
    
    private var viewstateservice: ViewStateService
    
    private var windowcontroller: ManagementWindowController
    
    public var answers: [Answer] {
        self.game.getQuestionSet().getSelectedQuestion()?.getAnswers() ?? []
    }
    
    public var selectedAnswerId: Answer.ID?
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.game = game
        self.viewstateservice = viewstateservice
        self.windowcontroller = windowcontroller
    }
    
    public func reveal() {
        if let selectedAnswerId {
            if let selectedAnswer = self.game.getQuestionSet().getSelectedQuestion()!.getAnswers().first(where: { $0.id == selectedAnswerId }) {
                if (!selectedAnswer.isRevealed()) {
                    _ = self.game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                        StateFamilyPlay.ACTION_OPENANSWER,
                        self.game.getQuestionSet().getSelectedQuestion()!.getAnswers().firstIndex { $0.id == self.selectedAnswerId! } ?? -1
                    ])
                    self.selectedAnswerId = nil
                } else {
                    _ = self.game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                        StateFamilyPlay.ACTION_OPENANSWER,
                        self.game.getQuestionSet().getSelectedQuestion()?.getAnswers().firstIndex { $0.id == self.selectedAnswerId } ?? -1
                    ])
                }
            }
        }
    }
    
    public func strike() {
        _ = self.game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [StateFamilyPlay.ACTION_STRIKE])
    }
}
